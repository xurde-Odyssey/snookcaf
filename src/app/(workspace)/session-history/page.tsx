import { requirePage } from "@/lib/auth/page";
import { requestToken } from "@/lib/auth/http";
import { snooker } from "@/features/snooker/server/service";
import { SessionHistory } from "@/components/snooker/workspace";
import type { SessionView } from "@/features/snooker/types";
export default async function Page() {
  const user = await requirePage("tables.view");
  const data = await snooker.list(await requestToken());
  return <SessionHistory sessions={JSON.parse(JSON.stringify(data)) as SessionView[]} actor={{ id: user.id, name: user.name, role: user.role, operationalArea: user.operationalArea }} />;
}
