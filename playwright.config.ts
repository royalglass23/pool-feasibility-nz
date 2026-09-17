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
    baseURL: "http://127.0.0.1:3000",
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
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
