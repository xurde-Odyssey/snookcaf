import { endpoint, json, readMutation, requestToken } from "@/lib/auth/http";
import { billing } from "@/features/billing/server/service";

export async function POST(request: Request, context: { params: Promise<{ checkoutId: string }> }) {
  return endpoint(async () => json({ result: await billing.repay(await requestToken(), (await context.params).checkoutId, await readMutation(request)) }, 201));
}
