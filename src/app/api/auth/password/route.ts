import { endpoint, json, readMutation, requestToken } from "@/lib/auth/http";
import { changePassword } from "@/lib/auth/service";
import { cookieName, cookieOptions } from "@/lib/auth/config";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return endpoint(async () => {
    const input = await readMutation(request);
    await changePassword(await requestToken(), input);
    const response = json({ ok: true });
    response.cookies.set(cookieName(), "", { ...cookieOptions(), maxAge: 0 });
    return response;
  });
}
