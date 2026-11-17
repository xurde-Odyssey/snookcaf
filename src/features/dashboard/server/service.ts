import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/service";

function localDay(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const p = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const start = new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day)) - 345 * 60_000);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

export async function dashboardMetrics(token: string | undefined) {
  const user = await requireUser(token, "dashboard.view");
  const { start, end } = localDay(new Date());
  const day: Prisma.PendingCheckoutWhereInput = { businessId: user.businessId, createdAt: { gte: start, lt: end }, status: { in: ["PENDING", "PARTIALLY_PAID", "CREDIT", "PAID"] } };
  const dayBillsQuery = db.pendingCheckout.findMany({ where: day, include: { session: { select: { calculatedAmount: true, approvedFinalAmount: true } } } });
  const [sales, collected, pending, credit, dayBills, tables, activeTables] = await Promise.all([
    db.pendingCheckout.aggregate({ where: day, _sum: { amount: true } }),
    db.payment.aggregate({ where: { businessId: user.businessId, createdAt: { gte: start, lt: end } }, _sum: { amount: true } }),
    db.pendingCheckout.aggregate({ where: { businessId: user.businessId, status: "PENDING" }, _sum: { amount: true }, _count: { _all: true } }),
    db.pendingCheckout.findMany({ where: { businessId: user.businessId, status: { in: ["CREDIT", "PARTIALLY_PAID"] } }, include: { payments: { select: { amount: true } } } }),
    dayBillsQuery,
    db.snookerTable.count({ where: { businessId: user.businessId, archivedAt: null } }),
    db.snookerSession.count({ where: { businessId: user.businessId, status: { in: ["RUNNING", "PAUSED"] } } }),
  ]);
  const creditOutstanding = credit.reduce((sum, bill) => sum.add((bill.amount ?? new Prisma.Decimal(0)).sub(bill.payments.reduce((paid, payment) => paid.add(payment.amount), new Prisma.Decimal(0)))), new Prisma.Decimal(0));
  const snookerSales = dayBills.reduce((sum, bill) => sum.add(bill.session ? (bill.session.approvedFinalAmount ?? bill.session.calculatedAmount ?? bill.referenceAmount) : 0), new Prisma.Decimal(0));
  const cafeSales = dayBills.reduce((sum, bill) => sum.add(bill.cafeSubtotal), new Prisma.Decimal(0));
  return {
    salesToday: sales._sum?.amount?.toFixed(2) ?? "0.00",
    collectedToday: collected._sum?.amount?.toFixed(2) ?? "0.00",
    pendingAmount: pending._sum?.amount?.toFixed(2) ?? "0.00",
    pendingCount: pending._count._all,
    creditOutstanding: creditOutstanding.toFixed(2),
    snookerSales: snookerSales.toFixed(2),
    cafeSales: cafeSales.toFixed(2),
    activeTables,
    totalTables: tables,
  };
}
