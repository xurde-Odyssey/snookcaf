import { requirePage } from "@/lib/auth/page";
import { requestToken } from "@/lib/auth/http";
import { snooker } from "@/features/snooker/server/service";
import { MenuWorkspace } from "@/components/snooker/workspace";
import type { MenuView } from "@/features/snooker/types";
export default async function Page() {
  await requirePage("menu.manage");
  const data = await snooker.catalog(await requestToken(), "menu");
  return <MenuWorkspace items={JSON.parse(JSON.stringify(data)) as MenuView[]} />;
}
