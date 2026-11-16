import { requirePage } from "@/lib/auth/page";
import { db } from "@/lib/db";
export default async function AuditPage() {
  const actor = await requirePage("audit.view");
  const events = await db.auditLog.findMany({ where: { businessId: actor.businessId }, orderBy: { createdAt: "desc" }, take: 100, include: { actor: { select: { name: true } } } });
  return <div className="space-y-6"><h1 className="text-3xl">Audit logs</h1><p className="text-sm text-muted-foreground">The 100 most recent security events. Timestamps are UTC.</p><div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead className="border-b bg-muted"><tr>{["Time", "Actor", "Action", "Target", "Details"].map(h => <th key={h} className="p-4">{h}</th>)}</tr></thead><tbody>{events.map(event => <tr key={event.id} className="border-b"><td className="whitespace-nowrap p-4">{event.createdAt.toISOString()}</td><td className="p-4">{event.actor?.name ?? "Unauthenticated"}</td><td className="p-4">{event.action}</td><td className="p-4">{event.targetId ?? "—"}</td><td className="max-w-sm break-all p-4">{JSON.stringify(event.metadata)}</td></tr>)}</tbody></table>{!events.length && <p className="p-8 text-center">No security events yet.</p>}</div></div>;
}
