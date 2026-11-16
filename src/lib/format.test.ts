import { describe, expect, it } from "vitest";
import { formatBusinessDate, formatMoney } from "./format";
describe("Nepal display defaults", () => {
  it("uses NPR for monetary display", () => {
    expect(formatMoney(12500)).toContain("12,500");
    expect(formatMoney(12500)).toMatch(/NPR|Rs/);
  });
  it("rolls the business date at Kathmandu midnight, independently of host timezone", () => {
    expect(formatBusinessDate(new Date("2026-11-14T18:14:59Z"))).toBe(
      "Saturday, 14 November 2026",
    );
    expect(formatBusinessDate(new Date("2026-11-14T18:15:00Z"))).toBe(
      "Sunday, 15 November 2026",
    );
  });
});
