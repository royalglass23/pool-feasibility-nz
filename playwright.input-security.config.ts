import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "input-security.spec.ts",
  retries: 0,
  workers: 1,
  forbidOnly: true,
  outputDir: "tmp/input-security/test-results",
  reporter: [
    ["list"],
    ["html", { outputFolder: "tmp/input-security/report", open: "never" }],
    ["json", { outputFile: "tmp/input-security/playwright.json" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:3217",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `node tests/security/input-validation-host.mjs ${process.env.INPUT_SECURITY_DIAGNOSTIC === "1" ? "diagnostic" : "serve"}`,
    url: "http://127.0.0.1:3217/partners",
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
