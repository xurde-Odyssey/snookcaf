import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/service";
import { endpoint, json, requestToken } from "@/lib/auth/http";

export async function GET() {
  return endpoint(async () => {
    const actor = await requireUser(await requestToken(), "cafe.order");
    const [products, activeSessions] = await Promise.all([
      db.menuItem.findMany({
        where: { businessId: actor.businessId, archivedAt: null },
        select: { id: true, name: true, category: true, price: true, archivedAt: true },
        orderBy: [{ category: "asc" }, { name: "asc" }],
      }),
      db.snookerSession.findMany({
        where: { businessId: actor.businessId, status: { in: ["RUNNING", "PAUSED"] } },
        select: { id: true, tableNumber: true, table: { select: { name: true } }, startedBy: { select: { name: true } } },
        orderBy: [{ tableNumber: "asc" }, { startedAt: "asc" }],
      }),
    ]);
    return json({
      products: products.map(product => ({ ...product, price: product.price.toFixed(2), available: true })),
      activeSessions: activeSessions.map(session => ({ id: session.id, tableNumber: session.tableNumber, tableName: session.table.name, startedBy: session.startedBy })),
    });
  });
}
