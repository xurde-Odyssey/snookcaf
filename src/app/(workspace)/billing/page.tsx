import { BillingWorkspace } from "@/components/billing/billing-workspace";
import { requirePage } from "@/lib/auth/page";
import { can } from "@/lib/auth/permissions";
export const dynamic = "force-dynamic";
export default async function BillingPage() {
  const user = await requirePage("billing.view");
  return <BillingWorkspace canConfigure={can(user, "settings.manage")} canDiscount={can(user, "billing.discount")} />;
}
