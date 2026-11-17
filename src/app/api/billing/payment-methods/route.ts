import { endpoint, json, readMutation, requestToken } from "@/lib/auth/http";
import { billing } from "@/features/billing/server/service";

export async function GET() { return endpoint(async () => json(await billing.getPaymentMethods(await requestToken()))); }
export async function PUT(request: Request) {
  return endpoint(async () => json(await billing.setPaymentMethods(await requestToken(), await readMutation(request))));
}
