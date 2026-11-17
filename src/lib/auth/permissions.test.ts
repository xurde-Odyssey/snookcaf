import { describe, expect, it } from "vitest";
import { can, canManageRole, permissions, roles } from "./permissions";
import { createStaffSchema, loginSchema, updateStaffSchema } from "./validation";
describe("central permissions", () => {
  it("gives owners every defined permission", () => {
    for (const permission of permissions) expect(can({ role: "OWNER", operationalArea: "NONE" }, permission)).toBe(true);
  });
  it("limits administration and role assignments", () => {
    expect(can({ role: "ADMIN", operationalArea: "BOTH" }, "ownership.manage")).toBe(false);
    for (const role of roles) expect(canManageRole("ADMIN", role)).toBe(["MANAGER", "CASHIER", "STAFF"].includes(role));
    for (const actor of ["MANAGER", "CASHIER", "STAFF"] as const) for (const target of roles) expect(canManageRole(actor, target)).toBe(false);
  });
  it("separates cash settlement from staff work and profit reports", () => {
    expect(can({ role: "CASHIER", operationalArea: "NONE" }, "billing.settle")).toBe(true);
    for (const role of ["CASHIER", "STAFF"] as const) for (const permission of ["reports.operational", "reports.profit", "settings.manage", "staff.manage"] as const) expect(can({ role, operationalArea: "BOTH" }, permission)).toBe(false);
    expect(can({ role: "STAFF", operationalArea: "BOTH" }, "billing.settle")).toBe(false);
  });
  it("allows discount authorization only to owners and admins", () => {
    expect(can({ role: "OWNER", operationalArea: "NONE" }, "billing.discount")).toBe(true);
    expect(can({ role: "ADMIN", operationalArea: "NONE" }, "billing.discount")).toBe(true);
    for (const role of ["MANAGER", "CASHIER", "STAFF"] as const) expect(can({ role, operationalArea: "BOTH" }, "billing.discount")).toBe(false);
  });
  it("defaults staff to no operations and enforces assigned areas", () => {
    expect(can({ role: "STAFF", operationalArea: "NONE" }, "tables.operate")).toBe(false);
    expect(can({ role: "STAFF", operationalArea: "TABLES" }, "tables.operate")).toBe(true);
    expect(can({ role: "STAFF", operationalArea: "TABLES" }, "cafe.order")).toBe(false);
    expect(can({ role: "STAFF", operationalArea: "CAFE" }, "cafe.order")).toBe(true);
    expect(can({ role: "STAFF", operationalArea: "CAFE" }, "tables.view")).toBe(false);
  });
});
it("validates input strictly and normalizes email", () => {
  expect(loginSchema.parse({ email: " Owner@Example.com ", password: "something" }).email).toBe("owner@example.com");
  expect(loginSchema.safeParse({ email: "a@b.com", password: "p", role: "OWNER" }).success).toBe(false);
  expect(createStaffSchema.safeParse({ name: "Test", email: "a@b.com", password: "short", currentPassword: "x" }).success).toBe(false);
  expect(updateStaffSchema.safeParse({ currentPassword: "x", permission: "OWNER" }).success).toBe(false);
});
