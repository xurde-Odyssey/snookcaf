import { endpoint, json, readMutation, requestToken } from "@/lib/auth/http";
import { snooker } from "@/features/snooker/server/service";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return endpoint(async () => json({ session: await snooker.get(await requestToken(), (await params).id) }));
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return endpoint(async () => {
    const data = await readMutation(request);
    return json({ session: await snooker.command(await requestToken(), (await params).id, data) });
  });
}
