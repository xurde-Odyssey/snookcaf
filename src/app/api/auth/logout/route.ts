import { endpoint, json, readMutation, requestToken } from "@/lib/auth/http";
import { logout } from "@/lib/auth/service";
import { cookieName, cookieOptions } from "@/lib/auth/config";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return endpoint(async () => {
    await readMutation(request);
    await logout(await requestToken());
    const response = json({ ok: true });
    response.cookies.set(cookieName(), "", { ...cookieOptions(), maxAge: 0 });
    return response;
  });
}
