import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); }, forbidden: () => { throw new Error("FORBIDDEN"); } }));
import { cookieName, cookieOptions, appOrigin } from "./config";
import { readMutation } from "./http";
import { requirePage } from "./page";
import { GET as staffGet, POST as staffPost } from "@/app/api/staff/route";
import { PATCH as staffPatch } from "@/app/api/staff/[id]/route";
import { GET as auditGet } from "@/app/api/audit/route";
import { GET as meGet } from "@/app/api/auth/me/route";
const request = (body = "{}", origin = "http://localhost:3000", contentType = "application/json") => new Request("http://localhost:3000/api/staff", { method: "POST", headers: { origin, "content-type": contentType }, body });
beforeEach(() => { vi.stubEnv("APP_ORIGIN", "http://localhost:3000"); });
afterEach(() => { vi.unstubAllEnvs(); });
describe("HTTP security boundaries without a database", () => {
  it("denies direct unauthenticated reads and writes before querying protected data", async () => {
    for (const response of [await staffGet(), await auditGet(), await meGet(), await staffPost(request()), await staffPatch(request(), { params: Promise.resolve({ id: "target" }) })]) {
      expect(response.status).toBe(401); expect(response.headers.get("cache-control")).toBe("no-store");
    }
    await expect(requirePage()).rejects.toThrow("REDIRECT:/login");
  });
  it("rejects missing and mismatched origins, wrong content types and malformed JSON", async () => {
    await expect(readMutation(request("{}", "https://evil.example"))).rejects.toMatchObject({ status: 403 });
    await expect(readMutation(request("{}", ""))).rejects.toMatchObject({ status: 403 });
    await expect(readMutation(request("{}", undefined, "text/plain"))).rejects.toMatchObject({ status: 415 });
    await expect(readMutation(request("{"))).rejects.toMatchObject({ status: 400 });
    await expect(readMutation(request(JSON.stringify({ data: "x".repeat(8192) })))).rejects.toMatchObject({ status: 413 });
  });
  it("uses Secure host-only HTTP-only cookies and requires HTTPS in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(cookieName()).toBe("__Host-cue-session");
    expect(cookieOptions()).toMatchObject({ secure: true, httpOnly: true, sameSite: "lax", path: "/", maxAge: 28800 });
    expect(cookieOptions()).not.toHaveProperty("domain"); expect(() => appOrigin()).toThrow("HTTPS");
    vi.stubEnv("APP_ORIGIN", "https://club.example"); expect(appOrigin()).toBe("https://club.example");
  });
});
