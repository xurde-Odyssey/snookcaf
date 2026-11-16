import { endpoint, json, requestToken } from "@/lib/auth/http";
import { requireUser } from "@/lib/auth/service";
import { db } from "@/lib/db";
export async function GET() {
  return endpoint(async () => {
    const actor = await requireUser(await requestToken(), "audit.view");
    const events = await db.auditLog.findMany({ where: { businessId: actor.businessId }, orderBy: { createdAt: "desc" }, take: 100,
      select: { id: true, actorId: true, action: true, targetId: true, metadata: true, createdAt: true, actor: { select: { name: true } } } });
    return json({ events });
  });
}
