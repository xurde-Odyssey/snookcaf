import { test, expect } from "@playwright/test";
test("unauthenticated pages redirect and direct APIs reject access", async ({ page, request }) => {
  await page.goto("/staff"); await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Staff sign in" })).toBeVisible();
  expect((await request.get("/api/staff")).status()).toBe(401);
  expect((await request.get("/api/audit")).status()).toBe(401);
  const response = await request.post("/api/staff", { headers: { origin: "http://127.0.0.1:3000" }, data: { role: "OWNER" } });
  expect(response.status()).toBe(401);
});
test("login rejects cross-origin form submissions", async ({ request }) => {
  const response = await request.post("/api/auth/login", { headers: { origin: "https://untrusted.example" }, data: { email: "someone@example.com", password: "not-a-credential" } });
  expect(response.status()).toBe(403);
});
