export const roles = ["OWNER", "ADMIN", "MANAGER", "CASHIER", "STAFF"] as const;
export type Role = (typeof roles)[number];
export const areas = ["NONE", "TABLES", "CAFE", "BOTH"] as const;
export type Area = (typeof areas)[number];
export type Identity = { role: Role; operationalArea: Area };
export const permissions = [
  "dashboard.view", "tables.view", "tables.operate", "cafe.order", "orders.view",
  "billing.view", "billing.settle", "billing.refund", "inventory.manage",
  "expenses.create", "customers.manage", "staff.manage", "reports.operational",
  "tables.manage", "menu.manage", "pricing.manage", "session.adjust_final_charge",
  "reports.profit", "settings.manage", "audit.view", "ownership.manage",
] as const;
export type Permission = (typeof permissions)[number];
const grants: Record<Role, readonly Permission[]> = {
  OWNER: permissions,
  ADMIN: permissions.filter(p => p !== "ownership.manage" && p !== "reports.profit" && p !== "audit.view"),
  MANAGER: ["dashboard.view", "tables.view", "tables.operate", "cafe.order", "orders.view", "billing.view", "billing.settle", "inventory.manage", "expenses.create", "reports.operational"],
  CASHIER: ["dashboard.view", "tables.view", "tables.operate", "cafe.order", "orders.view", "billing.view", "billing.settle"],
  STAFF: ["dashboard.view"],
};
export function can(user: Identity, permission: Permission): boolean {
  if (grants[user.role]?.includes(permission)) return true;
  if (user.role !== "STAFF") return false;
  if (["TABLES", "BOTH"].includes(user.operationalArea) && ["tables.view", "tables.operate"].includes(permission)) return true;
  return ["CAFE", "BOTH"].includes(user.operationalArea) && ["cafe.order", "orders.view"].includes(permission);
}
export function canManageRole(actor: Role, target: Role): boolean {
  return actor === "OWNER" || (actor === "ADMIN" && ["MANAGER", "CASHIER", "STAFF"].includes(target));
}
export const routePermissions: Record<string, Permission> = {
  "/": "dashboard.view", "/tables": "tables.view", "/pos": "cafe.order", "/orders": "orders.view",
  "/billing": "billing.view", "/inventory": "inventory.manage", "/expenses": "expenses.create",
  "/customers": "customers.manage", "/staff": "staff.manage", "/reports": "reports.operational",
  "/session-history": "tables.view", "/pricing-reviews": "session.adjust_final_charge",
  "/menu": "menu.manage", "/pricing": "pricing.manage",
  "/settings": "settings.manage", "/audit": "audit.view",
};
