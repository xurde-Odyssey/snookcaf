import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const cookie = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => cookie.token ? { value: cookie.token } : undefined }) }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); }, forbidden: () => { throw new Error("FORBIDDEN:403"); } }));
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { digest, login, logout, sessionUser, consumeLimit } from "@/lib/auth/service";
import { createStaff, updateStaff } from "@/features/staff/server/service";
import { requirePage } from "@/lib/auth/page";
import { POST as loginPost } from "@/app/api/auth/login/route";
import { POST as logoutPost } from "@/app/api/auth/logout/route";
import { POST as passwordPost } from "@/app/api/auth/password/route";
import { GET as staffGet, POST as staffPost } from "@/app/api/staff/route";
import { PATCH as staffPatch } from "@/app/api/staff/[id]/route";
import { GET as meGet } from "@/app/api/auth/me/route";
import { GET as auditGet } from "@/app/api/audit/route";
const password = "test-only-strong-password";
let businessId: string;
let ownerId: string;
let cashierId: string;
let hash: string;
const request = (body: unknown, origin = "http://localhost:3000", method = "POST") => new Request("http://localhost:3000/api/test", { method, headers: { "content-type": "application/json", origin }, body: JSON.stringify(body) });
beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL || process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) throw new Error("Use a disposable TEST_DATABASE_URL and set DATABASE_URL to the same value.");
  if (!new URL(process.env.TEST_DATABASE_URL).pathname.endsWith("_test")) throw new Error("The disposable integration database name must end in _test.");
  process.env.BUSINESS_SLUG = "phase2-integration";
  process.env.APP_ORIGIN = "http://localhost:3000";
  hash = await hashPassword(password);
});
beforeEach(async () => {
  cookie.token = undefined;
  // Guarded by explicit TEST_DATABASE_URL. Only this suite's business is deleted.
  const existing = await db.business.findUnique({ where: { slug: "phase2-integration" } });
  if (existing) {
    await db.auditLog.deleteMany({ where: { businessId: existing.id } });
    await db.staff.deleteMany({ where: { businessId: existing.id } });
    await db.business.delete({ where: { id: existing.id } });
  }
  await db.loginRateLimit.deleteMany();
  const b = await db.business.create({ data: { slug: "phase2-integration", name: "Test only" } }); businessId = b.id;
  const owner = await db.staff.create({ data: { businessId, email: "owner@phase2.test", name: "Owner", passwordHash: hash, role: "OWNER", mustChangePassword: false } }); ownerId = owner.id;
  const cashier = await db.staff.create({ data: { businessId, email: "cashier@phase2.test", name: "Cashier", passwordHash: hash, role: "CASHIER", mustChangePassword: false } }); cashierId = cashier.id;
});
afterAll(async () => { await db.$disconnect(); });
const signIn = async (email = "owner@phase2.test") => { const result = await login({ email, password }); cookie.token = result.token; return result.token; };
describe("authentication with PostgreSQL", () => {
  it("valid login sets HTTP-only cookie and restores safe identity", async () => {
    const response = await loginPost(request({ email: "OWNER@phase2.test", password }));
    expect(response.status).toBe(200);
    const setCookie = response.headers.get("set-cookie")!;
    expect(setCookie).toContain("HttpOnly"); expect(setCookie).toContain("SameSite=lax"); expect(setCookie).toContain("Max-Age=28800");
    cookie.token = /cue-session=([a-f0-9]+)/.exec(setCookie)![1];
    const body = await response.text(); expect(body).not.toContain(hash); expect(body).not.toContain(cookie.token);
    const me = await meGet(); expect(me.status).toBe(200); expect((await me.json()).user.id).toBe(ownerId);
    const stored = await db.session.findFirstOrThrow(); expect(stored.tokenHash).toBe(digest(cookie.token)); expect(stored.tokenHash).not.toBe(cookie.token);
  });
  it("invalid, unknown and disabled users receive the same generic error", async () => {
    await db.staff.update({ where: { id: cashierId }, data: { active: false } });
    for (const input of [{ email: "owner@phase2.test", password: "bad" }, { email: "unknown@phase2.test", password }, { email: "cashier@phase2.test", password }]) {
      const response = await loginPost(request(input)); expect(response.status).toBe(401); expect(await response.json()).toEqual({ error: "Invalid email or password." });
    }
    expect(await db.auditLog.count({ where: { action: "AUTH_LOGIN_FAILED" } })).toBe(3);
  });
  it("rejects expired sessions", async () => {
    const token = await signIn(); await db.session.updateMany({ data: { expiresAt: new Date(0) } });
    expect(await sessionUser(token)).toBeNull(); expect((await meGet()).status).toBe(401);
  });
  it("logout invalidates the server session and clears the cookie", async () => {
    const token = await signIn(); const response = await logoutPost(request({}));
    expect(response.status).toBe(200); expect(response.headers.get("set-cookie")).toContain("Max-Age=0"); expect(await sessionUser(token)).toBeNull();
    await logout(token); // Idempotent.
  });
  it("enforces deactivation even if an old session row remains", async () => {
    const token = await signIn(); await db.staff.update({ where: { id: ownerId }, data: { active: false } }); expect(await sessionUser(token)).toBeNull();
  });
  it("rate limits attempts atomically across concurrent requests", async () => {
    const allowed = await Promise.all(Array.from({ length: 20 }, () => consumeLimit("concurrency", 5, 60000)));
    expect(allowed.filter(Boolean)).toHaveLength(5);
    await db.loginRateLimit.create({ data: { key: `login:email:${digest("owner@phase2.test")}`, attempts: 10, expiresAt: new Date(Date.now() + 60000) } });
    expect((await loginPost(request({ email: "owner@phase2.test", password }))).status).toBe(429);
  });
});
describe("server authorization cannot be bypassed through direct API calls", () => {
  it("rejects unauthenticated reads and writes, and redirects page access", async () => {
    expect((await staffGet()).status).toBe(401); expect((await staffPost(request({}))).status).toBe(401);
    expect((await staffPatch(request({}, undefined, "PATCH"), { params: Promise.resolve({ id: ownerId }) })).status).toBe(401);
    await expect(requirePage()).rejects.toThrow("REDIRECT:/login");
  });
  it("returns forbidden for cashier APIs and protected page guards", async () => {
    await signIn("cashier@phase2.test");
    expect((await staffGet()).status).toBe(403); expect((await staffPost(request({ role: "OWNER" }))).status).toBe(403);
    expect((await auditGet()).status).toBe(403);
    await expect(requirePage("staff.manage")).rejects.toThrow("FORBIDDEN:403");
  });
  it("rejects cross-origin requests and unrecognized permission inputs", async () => {
    expect((await loginPost(request({ email: "owner@phase2.test", password }, "https://evil.test"))).status).toBe(403);
    await signIn();
    expect((await staffPost(request({ name: "Bad", email: "bad@phase2.test", password, currentPassword: password, role: "OWNER", permissions: ["all"] }))).status).toBe(400);
  });
  it("creates staff only with authorized role and actor password; audit contains no secrets", async () => {
    await signIn();
    const response = await staffPost(request({ name: "New Staff", email: "new@phase2.test", password, currentPassword: password }));
    expect(response.status).toBe(201); const created = (await response.json()).staff;
    expect(created.role).toBe("STAFF"); expect(created.operationalArea).toBe("NONE"); expect(created.passwordHash).toBeUndefined(); expect(created.mustChangePassword).toBe(true);
    const events = JSON.stringify(await db.auditLog.findMany()); expect(events).not.toContain(password); expect(events).not.toContain(hash); expect(events).not.toContain(cookie.token!);
    const bad = await staffPost(request({ name: "Bad", email: "bad@phase2.test", password, currentPassword: "wrong" })); expect(bad.status).toBe(403);
  });
  it("prevents ADMIN from escalating itself or touching owners", async () => {
    const admin = await db.staff.create({ data: { businessId, name: "Admin", email: "admin@phase2.test", passwordHash: hash, role: "ADMIN", mustChangePassword: false } });
    const token = await signIn("admin@phase2.test");
    await expect(createStaff(token, { name: "Owner", email: "new@phase2.test", password, currentPassword: password, role: "OWNER" })).rejects.toMatchObject({ status: 403 });
    for (const id of [admin.id, ownerId]) await expect(updateStaff(token, id, { role: "OWNER", currentPassword: password })).rejects.toMatchObject({ status: 403 });
    const result = await createStaff(token, { name: "Manager", email: "manager@phase2.test", password, currentPassword: password, role: "MANAGER" }); expect(result.role).toBe("MANAGER");
  });
  it("protects the last owner from demotion and deactivation", async () => {
    const token = await signIn();
    for (const data of [{ role: "STAFF" }, { active: false }]) await expect(updateStaff(token, ownerId, { ...data, currentPassword: password })).rejects.toMatchObject({ status: 409 });
    expect(await db.staff.count({ where: { role: "OWNER", active: true, businessId } })).toBe(1);
  });
  it("serializes concurrent owner demotions so an active owner remains", async () => {
    const second = await db.staff.create({ data: { businessId, name: "Second", email: "second@phase2.test", passwordHash: hash, role: "OWNER", mustChangePassword: false } });
    const firstToken = await signIn(); const secondToken = await signIn("second@phase2.test");
    const results = await Promise.allSettled([updateStaff(firstToken, ownerId, { role: "STAFF", currentPassword: password }), updateStaff(secondToken, second.id, { role: "STAFF", currentPassword: password })]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1); expect(await db.staff.count({ where: { businessId, role: "OWNER", active: true } })).toBe(1);
  });
  it("revokes sessions on account changes and forces reset recipients through password change", async () => {
    const oldToken = await signIn("cashier@phase2.test"); const ownerToken = await signIn();
    await updateStaff(ownerToken, cashierId, { password: "temporary-test-password", currentPassword: password });
    expect(await sessionUser(oldToken)).toBeNull();
    const reset = await login({ email: "cashier@phase2.test", password: "temporary-test-password" }); cookie.token = reset.token;
    await expect(requirePage()).rejects.toThrow("REDIRECT:/change-password"); expect((await staffGet()).status).toBe(403);
    const response = await passwordPost(request({ currentPassword: "temporary-test-password", password: "new-private-test-password" })); expect(response.status).toBe(200); expect(await sessionUser(reset.token)).toBeNull();
    const changed = await login({ email: "cashier@phase2.test", password: "new-private-test-password" }); expect(changed.user.mustChangePassword).toBe(false);
  });
  it("revokes every target session when an account is disabled", async () => {
    const token = await signIn("cashier@phase2.test"); const actorToken = await signIn();
    await updateStaff(actorToken, cashierId, { active: false, currentPassword: password });
    expect(await sessionUser(token)).toBeNull(); expect(await db.session.count({ where: { staffId: cashierId } })).toBe(0);
    expect(await db.auditLog.count({ where: { action: "STAFF_DEACTIVATED", targetId: cashierId } })).toBe(1);
  });
});
