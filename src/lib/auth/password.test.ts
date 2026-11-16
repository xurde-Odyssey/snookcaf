import { expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";
it("uses salted Argon2id and verifies without accepting incorrect passwords", async () => {
  const password = "a-unique-test-password";
  const first = await hashPassword(password); const second = await hashPassword(password);
  expect(first).toMatch(/^\$argon2id\$v=19\$m=65536,t=3,p=1\$/);
  expect(first).not.toBe(second);
  expect(await verifyPassword(password, first)).toBe(true);
  expect(await verifyPassword("wrong", first)).toBe(false);
  expect(await verifyPassword(password, "invalid")).toBe(false);
});
