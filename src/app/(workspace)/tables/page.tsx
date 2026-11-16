import { requirePage } from "@/lib/auth/page";
import { requestToken } from "@/lib/auth/http";
import { snooker } from "@/features/snooker/server/service";
import { TablesWorkspace } from "@/components/snooker/workspace";
import type { TableView } from "@/features/snooker/types";
export default async function Page() {
  const user = await requirePage("tables.view");
  const data = await snooker.catalog(await requestToken(), "tables");
  return <TablesWorkspace tables={JSON.parse(JSON.stringify(data)) as TableView[]} actor={{ id: user.id, name: user.name, role: user.role, operationalArea: user.operationalArea }} />;
}
