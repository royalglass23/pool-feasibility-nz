import { defineConfig, devices } from "@playwright/test";

// Never reuse a normal dev server: unset contact mode sends real email.
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["**/contact-form.spec.ts", "**/partnership-program.spec.ts"],
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3012",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node node_modules/next/dist/bin/next dev --webpack --port 3012",
    url: "http://127.0.0.1:3012",
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      NODE_ENV: "development",
      CONTACT_DELIVERY_MODE: "synthetic_test",
      PUBLIC_RATE_LIMIT_MODE: "local_test",
      VERCEL_ENV: "",
      RESEND_API_KEY: "",
      REPORT_FROM_EMAIL: "",
      PREVIEW_REPORT_FROM_EMAIL: "",
      SERVICEM8_FORWARD_EMAIL: "",
      DATABASE_URL: "",
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: "",
      NEXT_PUBLIC_GA4_MEASUREMENT_ID: "",
      NEXT_PUBLIC_HOTJAR_SITE_ID: "",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
