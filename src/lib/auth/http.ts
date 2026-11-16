import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { appOrigin, cookieName } from "./config";
import { AuthError } from "./errors";
export async function requestToken() { return (await cookies()).get(cookieName())?.value; }
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
export async function readMutation(request: Request): Promise<unknown> {
  if (request.headers.get("origin") !== appOrigin() || request.headers.get("sec-fetch-site") === "cross-site") throw new AuthError(403, "Request origin is not allowed.");
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new AuthError(415, "Send JSON content.");
  const reader = request.body?.getReader();
  if (!reader) throw new AuthError(400, "Invalid request.");
  const chunks: Uint8Array[] = []; let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 8192) { await reader.cancel(); throw new AuthError(413, "Request is too large."); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new AuthError(400, "Invalid JSON request."); }
}
export async function endpoint(work: () => Promise<Response>): Promise<Response> {
  try { return await work(); }
  catch (error) {
    if (error instanceof AuthError) {
      const response = json({ error: error.message }, error.status);
      if (error.status === 429) response.headers.set("Retry-After", "900");
      return response;
    }
    if (error instanceof ZodError) return json({ error: "Check the form fields. Use valid values and complete all required fields." }, 400);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return json({ error: "A record with those unique details already exists." }, 409);
    // Do not log input, Prisma errors, credentials or tokens.
    console.error("Security request failed", error instanceof Error ? error.name : "UnknownError");
    return json({ error: "Unable to complete the request. Please try again." }, 500);
  }
}
