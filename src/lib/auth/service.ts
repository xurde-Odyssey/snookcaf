import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { Prisma, type Staff } from "@prisma/client";
import { db } from "../db";
import { AuthError } from "./errors";
import { businessSlug, SESSION_SECONDS } from "./config";
import { can, type Permission } from "./permissions";
import { verifyPassword, hashPassword } from "./password";
import { loginSchema, changePasswordSchema } from "./validation";
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export type Tx = Prisma.TransactionClient;
export const publicStaffSelect = { id: true, name: true, email: true, role: true, operationalArea: true, active: true, mustChangePassword: true, createdAt: true, updatedAt: true } as const;
export function publicStaff(user: Staff) {
  const { id, name, email, role, operationalArea, active, mustChangePassword, createdAt, updatedAt } = user;
  return { id, name, email, role, operationalArea, active, mustChangePassword, createdAt, updatedAt };
}
export async function business(tx: Tx = db) {
  const result = await tx.business.findUnique({ where: { slug: businessSlug() } });
  if (!result) throw new AuthError(503, "Workspace is not configured. Contact the owner.");
  return result;
}
// All identity mutations lock the business row FIRST. This serializes concurrent
// owner changes, login issuance, logout and password resets across app instances.
export async function identityTransaction<T>(work: (tx: Tx, businessId: string) => Promise<T>): Promise<T> {
  return db.$transaction(async tx => {
    const b = await business(tx);
    await tx.$queryRaw`SELECT id FROM "Business" WHERE id = ${b.id} FOR UPDATE`;
    return work(tx, b.id);
  }, { maxWait: 10000, timeout: 15000 });
}
export async function audit(tx: Tx, businessId: string, actorId: string | null, action: string, targetId?: string, metadata: Prisma.InputJsonObject = {}) {
  await tx.auditLog.create({ data: { businessId, actorId, action, targetId, metadata } });
}
export async function sessionUser(token: string | undefined, tx: Tx = db): Promise<Staff | null> {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await tx.session.findUnique({ where: { tokenHash: digest(token) }, include: { staff: { include: { business: true } } } });
  if (!session || session.expiresAt <= new Date() || !session.staff.active || session.staff.business.slug !== businessSlug()) return null;
  return session.staff;
}
export async function requireUser(token: string | undefined, permission?: Permission, tx: Tx = db, allowPasswordChange = false) {
  const user = await sessionUser(token, tx);
  if (!user) throw new AuthError(401, "Please sign in.");
  if (user.mustChangePassword && !allowPasswordChange) throw new AuthError(403, "Change your password before continuing.");
  if (permission && !can(user, permission)) throw new AuthError(403, "You do not have permission for this action.");
  return user;
}
// Atomic, database-shared fixed windows; no client-supplied forwarding headers trusted.
export async function consumeLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = new Date();
  const expires = new Date(now.getTime() + windowMs);
  const rows = await db.$queryRaw<{ attempts: number }[]>`
    INSERT INTO "LoginRateLimit" (key, attempts, "expiresAt") VALUES (${key}, 1, ${expires})
    ON CONFLICT (key) DO UPDATE SET
      attempts = CASE WHEN "LoginRateLimit"."expiresAt" <= ${now} THEN 1 ELSE LEAST("LoginRateLimit".attempts + 1, ${limit + 1}) END,
      "expiresAt" = CASE WHEN "LoginRateLimit"."expiresAt" <= ${now} THEN ${expires} ELSE "LoginRateLimit"."expiresAt" END
    RETURNING attempts`;
  return rows[0].attempts <= limit;
}
export async function login(input: unknown) {
  if (!await consumeLimit("login:global", 120, 60_000)) throw new AuthError(429, "Too many sign-in attempts. Try again later.");
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) throw new AuthError(401, "Invalid email or password.");
  const { email, password } = parsed.data;
  const emailDigest = digest(email);
  if (!await consumeLimit(`login:email:${emailDigest}`, 10, 15 * 60_000)) throw new AuthError(429, "Too many sign-in attempts. Try again later.");
  const b = await business();
  const candidate = await db.staff.findUnique({ where: { email } });
  const valid = await verifyPassword(password, candidate?.passwordHash ?? "");
  const result = await identityTransaction(async (tx, businessId) => {
    const current = candidate ? await tx.staff.findUnique({ where: { id: candidate.id } }) : null;
    if (!valid || !current || !current.active || current.businessId !== b.id || current.passwordHash !== candidate?.passwordHash) {
      await audit(tx, businessId, null, "AUTH_LOGIN_FAILED", undefined, { emailDigest });
      return null;
    }
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000);
    await tx.session.create({ data: { tokenHash: digest(token), staffId: current.id, expiresAt } });
    await audit(tx, businessId, current.id, "AUTH_LOGIN_SUCCEEDED", current.id);
    return { token, user: publicStaff(current) };
  });
  if (!result) throw new AuthError(401, "Invalid email or password.");
  return result;
}
export async function logout(token?: string) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return;
  await identityTransaction(async (tx, businessId) => {
    const session = await tx.session.findUnique({ where: { tokenHash: digest(token) }, include: { staff: true } });
    if (!session || session.staff.businessId !== businessId) return;
    await tx.session.delete({ where: { id: session.id } });
    await audit(tx, businessId, session.staffId, "AUTH_LOGOUT", session.staffId);
  });
}
export async function reauthenticate(user: Staff, password: string) {
  if (!await consumeLimit(`reauth:${user.id}`, 5, 15 * 60_000)) throw new AuthError(429, "Too many attempts. Try again later.");
  if (!await verifyPassword(password, user.passwordHash)) {
    await audit(db, user.businessId, user.id, "AUTH_REAUTH_FAILED", user.id);
    throw new AuthError(403, "Unable to verify your current password.");
  }
}
export async function changePassword(token: string | undefined, input: unknown) {
  const data = changePasswordSchema.parse(input);
  const actor = await requireUser(token, undefined, db, true);
  await reauthenticate(actor, data.currentPassword);
  const passwordHash = await hashPassword(data.password);
  await identityTransaction(async (tx, businessId) => {
    const current = await requireUser(token, undefined, tx, true);
    if (current.passwordHash !== actor.passwordHash) throw new AuthError(409, "Account changed. Sign in again.");
    await tx.staff.update({ where: { id: current.id }, data: { passwordHash, mustChangePassword: false } });
    await tx.session.deleteMany({ where: { staffId: current.id } });
    await audit(tx, businessId, current.id, "PASSWORD_CHANGED", current.id);
  });
}
