import { endpoint, json, requestToken } from "@/lib/auth/http";
import { publicStaff, requireUser } from "@/lib/auth/service";
export async function GET() {
  return endpoint(async () => json({ user: publicStaff(await requireUser(await requestToken(), undefined, undefined, true)) }));
}
