import { z } from "zod";
import { endpoint, json, readMutation, requestToken } from "@/lib/auth/http";
import { snooker } from "@/features/snooker/server/service";
export async function GET(request: Request) {
  return endpoint(async () => {
    const kind = z.enum(["tables", "menu", "pricing"]).parse(new URL(request.url).searchParams.get("kind") ?? "tables");
    return json({ items: await snooker.catalog(await requestToken(), kind) });
  });
}
export async function POST(request: Request) {
  return endpoint(async () => {
    const data = await readMutation(request);
    return json(await snooker.mutateCatalog(await requestToken(), data));
  });
}
