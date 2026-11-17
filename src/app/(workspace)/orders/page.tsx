import { CafeOrdersWorkspace } from "@/components/cafe/cafe-workspace";
import { requirePage } from "@/lib/auth/page";
import { can } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const user = await requirePage("orders.view");
  return <CafeOrdersWorkspace canManage={can(user, "orders.manage")} canCancel={can(user, "orders.cancel")} />;
}
