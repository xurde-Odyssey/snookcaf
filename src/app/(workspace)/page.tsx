import { Dashboard } from "@/components/dashboard/dashboard";
import { formatBusinessDate } from "@/lib/format";
export const dynamic = "force-dynamic";
import { requirePage } from "@/lib/auth/page";
import { can } from "@/lib/auth/permissions";
import Link from "next/link";
import { navigation } from "@/lib/navigation";
import { routePermissions } from "@/lib/auth/permissions";
import { dashboardMetrics } from "@/features/dashboard/server/service";
import { requestToken } from "@/lib/auth/http";
export default async function Home() {
  const user = await requirePage("dashboard.view");
  if (!can(user, "reports.operational")) return (
    <div className="space-y-6">
      <h1 className="text-3xl">Dashboard</h1>
      <p>Welcome, {user.name}. Your assigned workspaces are below.</p>
      <p className="rounded-xl border border-orange-200 bg-orange-50 p-4">Open Snooker Tables to run sessions. Café ordering and payments are planned for later phases.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {navigation.filter(n => n.href !== "/" && can(user, routePermissions[n.href])).map(n => <Link key={n.href} href={n.href} className="rounded-xl border bg-white p-6 font-semibold hover:border-primary">{n.label}</Link>)}
      </div>
      {user.role === "STAFF" && user.operationalArea === "NONE" && <p className="rounded-xl border bg-white p-6">No operational area assigned. Ask an administrator to assign tables or café access.</p>}
    </div>
  );
  const metrics = await dashboardMetrics(await requestToken());
  return <Dashboard date={formatBusinessDate(new Date())} metrics={metrics} />;
}
