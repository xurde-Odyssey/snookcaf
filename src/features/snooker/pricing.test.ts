import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { adjustmentDifference, elapsedSeconds, referenceTotal, segmentAmount } from "./pricing";
import { sessionCommandSchema } from "./validation";
import { can, roles } from "@/lib/auth/permissions";
import { randomUUID } from "node:crypto";
describe("segment pricing", () => {
  it("charges thirty minutes at 400/hour as exactly 200", () => {
    expect(segmentAmount("HOURLY", "400", "1800", null).toFixed(2)).toBe("200.00");
  });
  it("prices frames from the entered count, never from elapsed time", () => {
    expect(segmentAmount("FRAME_WISE", "100", "999999", 2).toFixed(2)).toBe("200.00");
    expect(segmentAmount("FRAME_WISE", "100", "999999", 0).toFixed(2)).toBe("0.00");
    expect(() => segmentAmount("FRAME_WISE", "100", 0, null)).toThrow("frames");
  });
  it("adds multiple play-type segments without overwriting previous rates", () => {
    const amounts = [segmentAmount("HOURLY", "400", 1800, null), segmentAmount("FRAME_WISE", "100", 0, 2), segmentAmount("HOURLY", "800", 900, null)];
    expect(referenceTotal(amounts).toFixed(2)).toBe("600.00");
    expect(amounts[0].toFixed(2)).toBe("200.00");
  });
  it("excludes paused time and preserves millisecond precision", () => {
    const start = new Date("2026-01-01T00:00:00.000Z");
    const firstRun = elapsedSeconds(start, new Date("2026-01-01T00:10:00.125Z"));
    const pause = elapsedSeconds(null, new Date("2026-01-01T00:30:00Z"));
    const resumed = elapsedSeconds(new Date("2026-01-01T00:30:00Z"), new Date("2026-01-01T00:50:00Z"));
    expect(firstRun.add(pause).add(resumed).toString()).toBe("1800.125");
    expect(segmentAmount("HOURLY", "400", firstRun.add(resumed), null).toFixed(2)).toBe("200.01");
    expect(() => elapsedSeconds(start, new Date(0))).toThrow("backwards");
  });
  it("keeps the reference and calculates negative and positive adjustment differences", () => {
    const reference = new Prisma.Decimal("400");
    expect(adjustmentDifference(reference, "350").toFixed(2)).toBe("-50.00");
    expect(adjustmentDifference(reference, "450").toFixed(2)).toBe("50.00");
    expect(reference.toFixed(2)).toBe("400.00");
  });
  it("uses decimal arithmetic with per-segment half-up rounding", () => {
    expect(referenceTotal(["0.1", "0.2"]).toFixed(2)).toBe("0.30");
    expect(segmentAmount("HOURLY", "1", "18", null).toFixed(2)).toBe("0.01");
    expect(segmentAmount("FRAME_WISE", "0.10", 0, 3).toFixed(2)).toBe("0.30");
  });
  it("rejects negative, excessive-precision, missing-reason and spoofed-approver requests", () => {
    const command = { requestId: randomUUID(), revision: 0, action: "approve", adjustmentId: "test", amount: "350", reason: "Service adjustment" };
    expect(sessionCommandSchema.safeParse(command).success).toBe(true);
    for (const patch of [{ amount: "-1" }, { amount: "1.001" }, { amount: "1e3" }, { amount: 350 }, { reason: "   " }, { approverId: "owner" }]) expect(sessionCommandSchema.safeParse({ ...command, ...patch }).success).toBe(false);
  });
  it("grants custom-pricing and catalog administration only to owner/admin", () => {
    for (const role of roles) for (const permission of ["session.adjust_final_charge", "tables.manage", "menu.manage", "pricing.manage"] as const) expect(can({ role, operationalArea: "BOTH" }, permission)).toBe(role === "OWNER" || role === "ADMIN");
  });
});
