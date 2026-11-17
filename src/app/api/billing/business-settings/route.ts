import { endpoint, json, readMutation, requestToken } from "@/lib/auth/http";
import { billing } from "@/features/billing/server/service";
export async function GET() { return endpoint(async () => json(await billing.getBusinessDetails(await requestToken()))); }
export async function PUT(request: Request) { return endpoint(async () => json(await billing.setBusinessDetails(await requestToken(), await readMutation(request)))); }
