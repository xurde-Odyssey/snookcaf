import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const cookie = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => cookie.token ? { value: cookie.token } : undefined }) }));
import { db } from "@/lib/db";
import { digest } from "@/lib/auth/service";
import { createSnookerService } from "@/features/snooker/server/service";
import { POST as commandRoute } from "@/app/api/snooker/sessions/[id]/route";
import { GET as listRoute } from "@/app/api/snooker/sessions/route";
import type { Role } from "@prisma/client";
let time = new Date("2026-11-16T00:00:00Z");
const service = createSnookerService(() => new Date(time));
const advance = (seconds: number) => { time = new Date(time.getTime() + seconds * 1000); };
let businessId: string; let tableId: string; let admin: string; let staff: string;
async function account(role: Role) {
  const user = await db.staff.create({ data: { businessId, email: `${randomUUID()}@phase3.test`, name: role, role, operationalArea: "TABLES", passwordHash: "unused-direct-session-fixture", mustChangePassword: false } });
  const token = randomBytes(32).toString("hex");
  await db.session.create({ data: { staffId: user.id, tokenHash: digest(token), expiresAt: new Date(Date.now() + 3600000) } });
  return token;
}
beforeAll(() => {
  if (!process.env.TEST_DATABASE_URL || process.env.TEST_DATABASE_URL !== process.env.DATABASE_URL || !new URL(process.env.TEST_DATABASE_URL).pathname.endsWith("_test")) throw new Error("Run only against an explicitly selected disposable _test database.");
});
beforeEach(async () => {
  time = new Date("2026-11-16T00:00:00Z"); cookie.token = undefined;
  // Unique business per test: append-only histories are never deleted or bypassed.
  const slug = `phase3-${randomUUID()}`; process.env.BUSINESS_SLUG = slug; process.env.APP_ORIGIN = "http://localhost:3000";
  businessId = (await db.business.create({ data: { slug, name: "Isolated pricing test" } })).id;
  admin = await account("ADMIN"); staff = await account("STAFF");
  await service.mutateCatalog(admin, { requestId: randomUUID(), action: "pricing.set", hourlyRate: "400", frameRate: "100" });
  tableId = (await service.mutateCatalog(admin, { requestId: randomUUID(), action: "table.create", number: "1", name: "Test table", defaultPlayType: "HOURLY" })).id;
});
afterAll(async () => { await db.$disconnect(); });
const start = () => service.start(staff, { requestId: randomUUID(), tableId });
type PlaySession = Awaited<ReturnType<typeof start>>;
const command = (s: PlaySession, data: Record<string, unknown>, token = staff) => service.command(token, s.id, { requestId: randomUUID(), revision: s.revision, ...data });
async function finishMixed(proposal = false) {
  let s = await start(); advance(1800);
  s = await command(s, { action: "switch", playType: "FRAME_WISE" });
  return command(s, { action: "finish", frames: [{ segmentId: s.segments[1].id, count: 2 }], ...(proposal ? { proposal: { amount: "350", reason: "Customer service adjustment" } } : {}) });
}
describe("database-backed session pricing", () => {
  it("preserves the 400 reference, creates one checkout, releases the table, and approves 350 as admin", async () => {
    let s = await finishMixed();
    expect(s.calculatedAmount!.toFixed(2)).toBe("400.00"); expect(s.checkout!.amount!.toFixed(2)).toBe("400.00");
    s = await command(s, { action: "propose", amount: "350", reason: "Customer service adjustment" });
    expect(s.checkout!.status).toBe("AWAITING_APPROVAL"); expect(s.checkout!.amount).toBeNull(); expect(s.approvedFinalAmount).toBeNull();
    expect((await service.list(admin, true)).map(s => s.id)).toContain(s.id);
    const next = await start(); expect(next.id).not.toBe(s.id); // Operational table already released.
    s = await command(s, { action: "approve", adjustmentId: s.adjustments[0].id, amount: "350", reason: "Customer service adjustment" }, admin);
    expect(s.calculatedAmount!.toFixed(2)).toBe("400.00"); expect(s.approvedFinalAmount!.toFixed(2)).toBe("350.00"); expect(s.adjustmentDifference!.toFixed(2)).toBe("-50.00");
    expect(s.status).toBe("PENDING_CHECKOUT"); expect(s.checkout!.status).toBe("PENDING"); expect(s.checkout!.amount!.toFixed(2)).toBe("350.00");
    expect(s.adjustmentApprovedBy!.name).toBe("ADMIN"); expect(s.adjustmentApprovedAt).toEqual(time);
    expect(s.segments.map(s => s.calculatedAmount!.toFixed(2))).toEqual(["200.00", "200.00"]);
    expect(await db.pendingCheckout.count({ where: { sessionId: s.id } })).toBe(1);
    const audit = await db.auditLog.findFirstOrThrow({ where: { targetId: s.id, action: "ADJUSTMENT_APPROVED" } });
    expect(audit.actorId).toBe(s.adjustmentApprovedById); expect(audit.metadata).toMatchObject({ referenceAmount: "400.00", approvedAmount: "350.00", difference: "-50.00" });
  });
  it("excludes pauses using server elapsed time", async () => {
    let s = await start(); advance(600); s = await command(s, { action: "pause" }); advance(1200); s = await command(s, { action: "resume" }); advance(1200); s = await command(s, { action: "finish", frames: [] });
    expect(s.segments[0].billableSeconds.toString()).toBe("1800"); expect(s.calculatedAmount!.toString()).toBe("200");
  });
  it("preserves multiple switches and pricing snapshots after global rate updates", async () => {
    let s = await start(); advance(900);
    await service.mutateCatalog(admin, { requestId: randomUUID(), action: "pricing.set", hourlyRate: "800", frameRate: "200" });
    s = await command(s, { action: "switch", playType: "FRAME_WISE" }); advance(600);
    s = await command(s, { action: "switch", playType: "HOURLY" }); advance(900);
    s = await command(s, { action: "finish", frames: [{ segmentId: s.segments[1].id, count: 2 }] });
    expect(s.segments.map(s => s.appliedRate.toString())).toEqual(["400", "200", "800"]);
    expect(s.segments.map(s => s.calculatedAmount!.toString())).toEqual(["100", "400", "200"]);
    expect(s.calculatedAmount!.toString()).toBe("700"); expect(s.events.filter(e => e.action === "PLAY_TYPE_SWITCHED")).toHaveLength(2);
  });
  it("switches while paused without restarting the hourly clock", async () => {
    let s = await start(); advance(600); s = await command(s, { action: "pause" });
    s = await command(s, { action: "switch", playType: "FRAME_WISE" }); advance(600);
    s = await command(s, { action: "switch", playType: "HOURLY" }); advance(600);
    expect(s.segments[2].activeSince).toBeNull(); s = await command(s, { action: "finish", frames: [{ segmentId: s.segments[1].id, count: 0 }] });
    expect(s.calculatedAmount!.toFixed(2)).toBe("66.67");
  });
  it("rejects incomplete frame counts atomically", async () => {
    let s = await start(); advance(1800); s = await command(s, { action: "switch", playType: "FRAME_WISE" });
    await expect(command(s, { action: "finish", frames: [] })).rejects.toMatchObject({ status: 400 });
    const current = await service.get(staff, s.id); expect(current.status).toBe("RUNNING"); expect(current.segments[1].endedAt).toBeNull(); expect(current.checkout).toBeNull();
  });
  it("rejects missing reasons, negative amounts and supplied approver IDs", async () => {
    const s = await finishMixed(true);
    for (const fields of [{ amount: "350", reason: " " }, { amount: "-1", reason: "No" }, { amount: "350", reason: "No", approverId: "spoof" }]) await expect(command(s, { action: "approve", adjustmentId: s.adjustments[0].id, ...fields }, admin)).rejects.toThrow();
    expect((await service.get(admin, s.id)).approvedFinalAmount).toBeNull();
  });
  it("rejects manager, cashier and staff approvals even via direct HTTP handlers", async () => {
    const s = await finishMixed(true);
    for (const role of ["MANAGER", "CASHIER", "STAFF"] as const) {
      cookie.token = await account(role);
      const response = await commandRoute(new Request("http://localhost:3000/api/snooker/sessions/test", { method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify({ requestId: randomUUID(), revision: s.revision, action: "approve", adjustmentId: s.adjustments[0].id, amount: "350", reason: "Unauthorized" }) }), { params: Promise.resolve({ id: s.id }) });
      expect(response.status).toBe(403);
    }
    cookie.token = undefined; expect((await listRoute(new Request("http://localhost:3000/api/snooker/sessions"))).status).toBe(401);
    expect((await service.get(admin, s.id)).checkout!.amount).toBeNull();
  });
  it("handles rejection and cancellation by restoring the full reference obligation", async () => {
    let s = await finishMixed(true);
    s = await command(s, { action: "reject", adjustmentId: s.adjustments[0].id, reason: "Use calculated amount" }, admin);
    expect(s.checkout!.amount!.toString()).toBe("400"); expect(s.adjustments[0].status).toBe("REJECTED");
    s = await command(s, { action: "propose", amount: "350", reason: "Second request" });
    const pending = s.adjustments.find(a => a.status === "REQUESTED")!;
    s = await command(s, { action: "cancel", adjustmentId: pending.id, reason: "Withdrawn" });
    expect(s.checkout!.status).toBe("PENDING"); expect(s.checkout!.amount!.toString()).toBe("400"); expect(s.adjustments).toHaveLength(2);
  });
  it("deduplicates start, switch, finalize and approval requests", async () => {
    const begin = { requestId: randomUUID(), tableId }; let s = await service.start(staff, begin); expect((await service.start(staff, begin)).id).toBe(s.id);
    advance(1800); const change = { requestId: randomUUID(), revision: s.revision, action: "switch", playType: "FRAME_WISE" };
    s = await service.command(staff, s.id, change); expect((await service.command(staff, s.id, change)).segments).toHaveLength(2);
    const finish = { requestId: randomUUID(), revision: s.revision, action: "finish", frames: [{ segmentId: s.segments[1].id, count: 2 }], proposal: { amount: "350", reason: "Service" } };
    s = await service.command(staff, s.id, finish); await service.command(staff, s.id, finish);
    const approval = { requestId: randomUUID(), revision: s.revision, action: "approve", adjustmentId: s.adjustments[0].id, amount: "350", reason: "Service" };
    await service.command(admin, s.id, approval); await service.command(admin, s.id, approval);
    expect(await db.pendingCheckout.count({ where: { sessionId: s.id } })).toBe(1);
    expect(await db.sessionPricingEvent.count({ where: { sessionId: s.id, action: "ADJUSTMENT_APPROVED" } })).toBe(1);
    await expect(service.command(admin, s.id, { ...approval, amount: "300" })).rejects.toMatchObject({ status: 409 });
  });
  it("allows only one concurrent finalization and approval with distinct request IDs", async () => {
    let s = await start(); advance(1800);
    const finishes = await Promise.allSettled([command(s, { action: "finish", frames: [], proposal: { amount: "150", reason: "Service" } }), command(s, { action: "finish", frames: [], proposal: { amount: "150", reason: "Service" } })]);
    expect(finishes.filter(r => r.status === "fulfilled")).toHaveLength(1);
    s = await service.get(admin, s.id);
    const approvals = await Promise.allSettled([command(s, { action: "approve", adjustmentId: s.adjustments[0].id, amount: "150", reason: "Service" }, admin), command(s, { action: "approve", adjustmentId: s.adjustments[0].id, amount: "100", reason: "Other" }, admin)]);
    expect(approvals.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.pendingCheckout.count({ where: { sessionId: s.id } })).toBe(1);
  });
  it("prevents concurrent starts and keeps active tables from being archived", async () => {
    const starts = await Promise.allSettled([start(), start()]); expect(starts.filter(r => r.status === "fulfilled")).toHaveLength(1);
    await expect(service.mutateCatalog(admin, { requestId: randomUUID(), action: "table.update", id: tableId, number: "1", name: "Test", defaultPlayType: "HOURLY", archived: true })).rejects.toMatchObject({ status: 409 });
  });
  it("database constraints reject overlapping segments and historical edits", async () => {
    let s = await start();
    await expect(db.sessionPricingSegment.create({ data: { sessionId: s.id, sequence: 1, pricingVersionId: s.segments[0].pricingVersionId, playType: "HOURLY", appliedRate: "400", startedAt: time, activeSince: time } })).rejects.toThrow();
    advance(1800); s = await command(s, { action: "finish", frames: [] });
    await expect(db.sessionPricingSegment.update({ where: { id: s.segments[0].id }, data: { appliedRate: "1" } })).rejects.toThrow();
    await expect(db.snookerSession.update({ where: { id: s.id }, data: { calculatedAmount: "1" } })).rejects.toThrow();
    await expect(db.pendingCheckout.update({ where: { sessionId: s.id }, data: { amount: "1" } })).rejects.toThrow();
    await expect(db.sessionPricingEvent.delete({ where: { id: s.events[0].id } })).rejects.toThrow();
    const audit = await db.auditLog.findFirstOrThrow({ where: { targetId: s.id, action: "SESSION_FINALIZED" } });
    await expect(db.auditLog.delete({ where: { id: audit.id } })).rejects.toThrow();
  });
  it("restricts catalog writes and supports archived menu/table records without deletion", async () => {
    await expect(service.mutateCatalog(staff, { requestId: randomUUID(), action: "pricing.set", hourlyRate: "1", frameRate: "1" })).rejects.toMatchObject({ status: 403 });
    const item = await service.mutateCatalog(admin, { requestId: randomUUID(), action: "menu.create", name: "Coffee", price: "100" });
    await service.mutateCatalog(admin, { requestId: randomUUID(), action: "menu.update", id: item.id, name: "Coffee", price: "120", archived: true });
    expect((await db.menuItem.findUniqueOrThrow({ where: { id: item.id } })).archivedAt).not.toBeNull();
    await service.mutateCatalog(admin, { requestId: randomUUID(), action: "table.update", id: tableId, number: "1", name: "Archived", defaultPlayType: "FRAME_WISE", archived: true });
    await expect(start()).rejects.toMatchObject({ status: 404 });
  });
});
