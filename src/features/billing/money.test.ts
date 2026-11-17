import { describe, expect, it } from "vitest";
import { calculateDiscount, cashChange, paymentBalance } from "./money";

describe("cash settlement arithmetic", () => {
  it("calculates exact decimal change without floating point drift", () => {
    expect(cashChange("560.35", "600.00").toFixed(2)).toBe("39.65");
  });
  it("rejects underpayment and negative totals", () => {
    expect(() => cashChange("560.35", "560.34")).toThrow("Cash received must cover the full bill.");
    expect(() => cashChange("-1", "0")).toThrow("Bill total cannot be negative.");
  });
  it("calculates fixed and percentage discounts using decimal precision", () => {
    expect(calculateDiscount("1600", "FIXED", "100").toFixed(2)).toBe("100.00");
    expect(calculateDiscount("1600", "PERCENTAGE", "10").toFixed(2)).toBe("160.00");
    expect(calculateDiscount("10", "PERCENTAGE", "12.5").toFixed(2)).toBe("1.25");
    expect(() => calculateDiscount("100", "FIXED", "101")).toThrow();
    expect(() => calculateDiscount("100", "PERCENTAGE", "100.01")).toThrow();
  });
  it("calculates split collection and credit balance", () => {
    const result = paymentBalance("1500", "0", "500", "700");
    expect(result.allocations.toFixed(2)).toBe("1200.00");
    expect(result.remaining.toFixed(2)).toBe("300.00");
    expect(() => paymentBalance("1500", "1000", "300", "300")).toThrow();
  });
});
