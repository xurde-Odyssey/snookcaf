import { endpoint, json, readMutation, requestToken } from "@/lib/auth/http";
import { createStaff, listStaff } from "@/features/staff/server/service";
export async function GET() { return endpoint(async () => json({ staff: await listStaff(await requestToken()) })); }
export async function POST(request: Request) {
  return endpoint(async () => {
    const input = await readMutation(request);
    return json({ staff: await createStaff(await requestToken(), input) }, 201);
  });
}
