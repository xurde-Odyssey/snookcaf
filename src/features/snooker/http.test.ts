import { afterEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
import { GET as catalogGet, POST as catalogPost } from "@/app/api/snooker/catalog/route";
import { GET as sessionsGet, POST as sessionsPost } from "@/app/api/snooker/sessions/route";
import { GET as sessionGet, POST as sessionPost } from "@/app/api/snooker/sessions/[id]/route";
afterEach(() => vi.unstubAllEnvs());
it("blocks unauthenticated direct catalog, session and approval APIs before protected queries", async () => {
  vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
  const request = (body: unknown) => new Request("http://localhost:3000/api/snooker/sessions", { method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify(body) });
  const context = { params: Promise.resolve({ id: "session-id" }) };
  const responses = [
    await catalogGet(new Request("http://localhost:3000/api/snooker/catalog")),
    await sessionsGet(new Request("http://localhost:3000/api/snooker/sessions?review=true")),
    await sessionGet(new Request("http://localhost:3000/api/snooker/sessions/session-id"), context),
    await sessionsPost(request({ requestId: randomUUID(), tableId: "table-id" })),
    await catalogPost(request({ requestId: randomUUID(), action: "pricing.set", hourlyRate: "1", frameRate: "1" })),
    await sessionPost(request({ requestId: randomUUID(), revision: 0, action: "approve", adjustmentId: "adjustment-id", amount: "0", reason: "Forged approval" }), context),
  ];
  for (const response of responses) { expect(response.status).toBe(401); expect(response.headers.get("cache-control")).toBe("no-store"); }
});
