import { defineConfig, devices } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";
const database = process.env.TEST_DATABASE_URL;
if (!database || !new URL(database).pathname.endsWith("_test")) throw new Error("Phase 3 browser tests require a disposable TEST_DATABASE_URL ending in _test.");
process.env.PHASE3_TEST_CLOCK_FILE ||= join(tmpdir(), "snookercaf-phase3-e2e-clock.txt");
export default defineConfig({
  testDir: "./tests/e2e-phase3", workers: 1, fullyParallel: false, timeout: 60000,
  use: { baseURL: "http://127.0.0.1:3103", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3103", url: "http://127.0.0.1:3103/login", reuseExistingServer: false,
    env: { DATABASE_URL: database, BUSINESS_SLUG: "phase3-browser", APP_ORIGIN: "http://127.0.0.1:3103", PHASE3_TEST_CLOCK_FILE: process.env.PHASE3_TEST_CLOCK_FILE },
  },
});
