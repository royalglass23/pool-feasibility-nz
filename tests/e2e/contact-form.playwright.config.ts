import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "contact-form.spec.ts",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [
    [
      "html",
      { open: "never", outputFolder: "../../playwright-report/contact-form" },
    ],
    ["list"],
  ],
  use: {
    baseURL: "http://127.0.0.1:3015",
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
    command: "npm.cmd run dev -- --port 3015",
    env: {
      CONTACT_DELIVERY_MODE: "synthetic_test",
      PUBLIC_RATE_LIMIT_MODE: "local_test",
      VERCEL_ENV: "",
    },
    url: "http://127.0.0.1:3015",
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
