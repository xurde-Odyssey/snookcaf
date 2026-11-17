import { endpoint, json, requestToken } from "@/lib/auth/http";
import { billing } from "@/features/billing/server/service";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return endpoint(async () => json({ bill: await billing.get(await requestToken(), (await context.params).id) }));
}
