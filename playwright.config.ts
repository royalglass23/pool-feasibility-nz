import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

process.env.INTERNAL_REPORT_SIGNING_SECRET ??=
  "playwright-report-signing-secret-2026-07-22-at-least-32-bytes";
process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID ??= "G-TEST123";
process.env.NEXT_PUBLIC_HOTJAR_SITE_ID ??= "123456";

export default defineConfig({
  testDir: "./tests/e2e",
  // These submit contact emails and must use the isolated synthetic server.
  testIgnore: [
    "**/contact-form.spec.ts",
    "**/input-security.spec.ts",
    "**/partnership-program.spec.ts",
  ],
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 3100",
    url: "http://127.0.0.1:3100",
    env: {
      VERCEL_ENV: "preview",
      REPORT_DELIVERY_MODE: "disabled",
      PROVIDER_RETRY_COUNT: "0",
      PROVIDER_TIMEOUT_MS: "1000",
      ...(process.env.DATABASE_URL_DEV
        ? {
            DATABASE_URL: process.env.DATABASE_URL_DEV,
            DATABASE_URL_DEV: process.env.DATABASE_URL_DEV,
          }
        : {}),
    },
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
