import { endpoint, json, readMutation } from "@/lib/auth/http";
import { login } from "@/lib/auth/service";
import { cookieName, cookieOptions } from "@/lib/auth/config";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return endpoint(async () => {
    const input = await readMutation(request);
    const result = await login(input);
    const response = json({ user: result.user });
    response.cookies.set(cookieName(), result.token, cookieOptions());
    return response;
  });
}
