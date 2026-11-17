import { endpoint, json, readMutation, requestToken } from "@/lib/auth/http";
import { billing } from "@/features/billing/server/service";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return endpoint(async () => json({ transaction: await billing.settle(await requestToken(), (await context.params).id, await readMutation(request)) }, 201));
}
