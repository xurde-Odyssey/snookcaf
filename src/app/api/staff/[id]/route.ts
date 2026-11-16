import { endpoint, json, readMutation, requestToken } from "@/lib/auth/http";
import { updateStaff } from "@/features/staff/server/service";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return endpoint(async () => {
    const input = await readMutation(request);
    return json({ staff: await updateStaff(await requestToken(), (await params).id, input) });
  });
}
