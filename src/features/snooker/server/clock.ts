import "server-only";
import { readFileSync } from "node:fs";
// Only a local, disposable-database test harness may control time. No HTTP clock override.
export function sessionClock(): Date {
  const file = process.env.PHASE3_TEST_CLOCK_FILE;
  if (!file) return new Date();
  if (process.env.NODE_ENV === "production" || !new URL(process.env.DATABASE_URL || "").pathname.endsWith("_test")) throw new Error("Test clock requires a non-production test database.");
  const now = new Date(readFileSync(file, "utf8").trim());
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid test clock.");
  return now;
}
