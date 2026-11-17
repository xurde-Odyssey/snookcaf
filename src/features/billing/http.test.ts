import { afterEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
import { GET } from "@/app/api/billing/route";
import { POST } from "@/app/api/billing/[id]/payment/route";

afterEach(() => vi.unstubAllEnvs());
it("rejects direct billing and settlement API requests without a session", async () => {
  vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
  const get = await GET(new Request("http://localhost:3000/api/billing"));
  const post = await POST(new Request("http://localhost:3000/api/billing/checkout-id/payment", {
    method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" },
    body: JSON.stringify({ requestId: randomUUID(), cashAmount: "10.00", qrAmount: "0" }),
  }), { params: Promise.resolve({ id: "checkout-id" }) });
  expect(get.status).toBe(401);
  expect(post.status).toBe(401);
});
