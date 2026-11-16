import { requirePage } from "@/lib/auth/page";
import { requestToken } from "@/lib/auth/http";
import { snooker } from "@/features/snooker/server/service";
import { PricingWorkspace } from "@/components/snooker/workspace";
import type { PricingView } from "@/features/snooker/types";
export default async function Page() {
  await requirePage("pricing.manage");
  const data = await snooker.catalog(await requestToken(), "pricing");
  return <PricingWorkspace versions={JSON.parse(JSON.stringify(data)) as PricingView[]} />;
}
