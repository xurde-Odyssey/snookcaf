import { endpoint, json, readMutation, requestToken } from "@/lib/auth/http";
import { snooker } from "@/features/snooker/server/service";
export async function GET(request: Request) {
  return endpoint(async () => json({ sessions: await snooker.list(await requestToken(), new URL(request.url).searchParams.get("review") === "true") }));
}
export async function POST(request: Request) {
  return endpoint(async () => {
    const data = await readMutation(request);
    return json({ session: await snooker.start(await requestToken(), data) }, 201);
  });
}
