import { LayoutDashboard, CircleDot, Coffee, ReceiptText, Package, Wallet, UserRoundCog, ChartNoAxesCombined, Settings, ShieldCheck, ClipboardList, SlidersHorizontal } from "lucide-react";
import type { Permission } from "./auth/permissions";
type NavigationChild = { label: string; href: string; permission: Permission; phase: number };
export const navigationGroups: { label: string; href: string; icon: typeof LayoutDashboard; permission: Permission; phase?: number; children?: NavigationChild[] }[] = [
  { label: "Overview", href: "/", icon: LayoutDashboard, permission: "dashboard.view" },
  { label: "Snooker", href: "/tables", icon: CircleDot, permission: "tables.view", children: [
    { label: "Tables", href: "/tables", permission: "tables.view", phase: 3 },
    { label: "Session History", href: "/session-history", permission: "tables.view", phase: 3 },
    { label: "Play Rates", href: "/pricing", permission: "pricing.manage", phase: 3 },
    { label: "Pricing Reviews", href: "/pricing-reviews", permission: "session.adjust_final_charge", phase: 3 },
  ] },
  { label: "Café POS", href: "/pos", icon: Coffee, permission: "cafe.order", children: [
    { label: "Point of Sale", href: "/pos", permission: "cafe.order", phase: 4 },
    { label: "Orders", href: "/orders", permission: "orders.view", phase: 4 },
  ] },
  { label: "Billing", href: "/billing", icon: ReceiptText, permission: "billing.view", phase: 5 },
  { label: "Inventory", href: "/inventory", icon: Package, permission: "inventory.manage", phase: 6 },
  { label: "Expenses", href: "/expenses", icon: Wallet, permission: "expenses.create", phase: 6 },
  { label: "Reports", href: "/reports", icon: ChartNoAxesCombined, permission: "reports.operational", phase: 8 },
  { label: "Settings", href: "/settings", icon: Settings, permission: "settings.manage", children: [
    { label: "Business", href: "/settings", permission: "settings.manage", phase: 2 },
    { label: "Table Configuration", href: "/tables", permission: "tables.manage", phase: 3 },
    { label: "Café Menu", href: "/menu", permission: "menu.manage", phase: 3 },
    { label: "Staff & Permissions", href: "/staff", permission: "staff.manage", phase: 2 },
    { label: "Customers", href: "/customers", permission: "customers.manage", phase: 7 },
    { label: "Audit Logs", href: "/audit", permission: "audit.view", phase: 2 },
  ] },
];
const navigationChildren: NavigationChild[] = navigationGroups.flatMap(group => group.children ?? []);
export const navigation = [
  ...navigationGroups.map(({label,href,icon,phase,permission}) => ({label,href,icon,phase:phase ?? 1,permission})),
  ...navigationChildren.filter((item,index,all) => all.findIndex(other=>other.href===item.href)===index).map(item=>({...item,icon: item.href.includes("audit") ? ShieldCheck : item.href.includes("session")||item.href==="/orders" ? ClipboardList : item.href==="/pricing"||item.href==="/settings" ? SlidersHorizontal : item.href==="/staff" ? UserRoundCog : item.href==="/billing" ? ReceiptText : item.href==="/menu" ? Coffee : CircleDot})),
];
