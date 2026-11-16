import "server-only";
import { db } from "@/lib/db";
import { AuthError } from "@/lib/auth/errors";
import { canManageRole } from "@/lib/auth/permissions";
import { createStaffSchema, updateStaffSchema } from "@/lib/auth/validation";
import { hashPassword } from "@/lib/auth/password";
import { audit, identityTransaction, publicStaffSelect, reauthenticate, requireUser } from "@/lib/auth/service";
export async function listStaff(token?: string) {
  const actor = await requireUser(token, "staff.manage");
  return db.staff.findMany({ where: { businessId: actor.businessId }, select: publicStaffSelect, orderBy: { createdAt: "desc" }, take: 500 });
}
export async function createStaff(token: string | undefined, input: unknown) {
  const actor = await requireUser(token, "staff.manage");
  const data = createStaffSchema.parse(input);
  if (!canManageRole(actor.role, data.role)) throw new AuthError(403, "You cannot assign this role.");
  await reauthenticate(actor, data.currentPassword);
  const passwordHash = await hashPassword(data.password);
  return identityTransaction(async (tx, businessId) => {
    const current = await requireUser(token, "staff.manage", tx);
    if (current.passwordHash !== actor.passwordHash || !canManageRole(current.role, data.role)) throw new AuthError(403, "Account permissions changed. Sign in again.");
    const user = await tx.staff.create({ data: { businessId, name: data.name, email: data.email, passwordHash, role: data.role, operationalArea: data.operationalArea, mustChangePassword: true }, select: publicStaffSelect });
    await audit(tx, businessId, current.id, "STAFF_CREATED", user.id, { role: user.role, operationalArea: user.operationalArea });
    return user;
  });
}
export async function updateStaff(token: string | undefined, id: string, input: unknown) {
  const actor = await requireUser(token, "staff.manage");
  const data = updateStaffSchema.parse(input);
  await reauthenticate(actor, data.currentPassword);
  const passwordHash = data.password ? await hashPassword(data.password) : undefined;
  return identityTransaction(async (tx, businessId) => {
    const current = await requireUser(token, "staff.manage", tx);
    if (current.passwordHash !== actor.passwordHash) throw new AuthError(409, "Account changed. Sign in again.");
    const target = await tx.staff.findFirst({ where: { id, businessId } });
    if (!target) throw new AuthError(404, "Staff account not found.");
    if (!canManageRole(current.role, target.role) || (data.role && !canManageRole(current.role, data.role))) throw new AuthError(403, "You cannot manage this account or assign this role.");
    if (target.role === "OWNER" && target.active && (data.role && data.role !== "OWNER" || data.active === false)) {
      const owners = await tx.staff.count({ where: { businessId, role: "OWNER", active: true } });
      if (owners <= 1) throw new AuthError(409, "The business must retain at least one active owner.");
    }
    const result = await tx.staff.update({ where: { id }, data: {
      role: data.role, active: data.active, operationalArea: data.operationalArea,
      ...(passwordHash ? { passwordHash, mustChangePassword: true } : {}),
    }, select: publicStaffSelect });
    // Revoke every session on ANY security update, including area changes and reactivation.
    const revoked = await tx.session.deleteMany({ where: { staffId: id } });
    await audit(tx, businessId, current.id, "STAFF_SESSIONS_REVOKED", id, { count: revoked.count });
    if (data.role && target.role !== data.role) await audit(tx, businessId, current.id, "STAFF_ROLE_CHANGED", id, { from: target.role, to: data.role });
    if (data.active !== undefined && data.active !== target.active) await audit(tx, businessId, current.id, data.active ? "STAFF_ACTIVATED" : "STAFF_DEACTIVATED", id);
    if (data.operationalArea !== undefined && data.operationalArea !== target.operationalArea) await audit(tx, businessId, current.id, "STAFF_AREA_CHANGED", id, { from: target.operationalArea, to: data.operationalArea });
    if (passwordHash) await audit(tx, businessId, current.id, "STAFF_PASSWORD_RESET", id);
    return result;
  });
}
