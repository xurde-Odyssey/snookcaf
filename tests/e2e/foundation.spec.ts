import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  if (!process.env.E2E_OWNER_EMAIL || !process.env.E2E_OWNER_PASSWORD) throw new Error("Set E2E_OWNER_EMAIL and E2E_OWNER_PASSWORD for the seeded development owner.");
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(process.env.E2E_OWNER_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/");
});
test("preview supports filtering, keyboard dialogs, search, and empty states", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "All figures, orders, and table states are fictional samples.",
      { exact: false },
    ),
  ).toBeVisible();
  await page.getByLabel("Filter tables by status").selectOption("available");
  await expect(
    page.getByRole("button", { name: /Corner Pocket/ }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /The Classic/ })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: /Corner Pocket/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Corner Pocket/ }),
  ).toBeFocused();
  await page
    .getByRole("textbox", { name: "Search sample orders" })
    .fill("ORD-023");
  await expect(page.getByRole("cell", { name: "#ORD-023" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "#ORD-024" })).toHaveCount(0);
  await page.getByLabel("Show sample data").uncheck();
  await expect(page.getByText("Your revenue story starts here")).toBeVisible();
  await expect(page.getByText("No tables to show")).toBeVisible();
});
test("navigation works across viewport sizes without page overflow", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  if (isMobile)
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("link", { name: "Inventory", exact: true })
    .filter({ visible: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Inventory", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Planned · Phase 6")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("link", { name: "Back to dashboard" }).click();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
});
