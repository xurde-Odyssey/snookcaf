import { endpoint, json, requestToken } from "@/lib/auth/http";
import { billing } from "@/features/billing/server/service";

export async function GET(_request: Request, context: { params: Promise<{ customerId: string }> }) {
  return endpoint(async () => json({ customer: await billing.getCreditCustomer(await requestToken(), (await context.params).customerId) }));
}
