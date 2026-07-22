import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "report-security.spec.ts",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [
    [
      "html",
      {
        outputFolder:
          "../../test-results/security-expandable-assessment-pdf/report",
        open: "never",
      },
    ],
    [
      "json",
      {
        outputFile:
          "../../test-results/security-expandable-assessment-pdf/results.json",
      },
    ],
    ["list"],
  ],
  outputDir: "../../test-results/security-expandable-assessment-pdf/artifacts",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm.cmd run start -- -p 3100",
    port: 3100,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      NODE_ENV: "production",
      NODE_OPTIONS: "--conditions=react-server",
      INTERNAL_ACCESS_USERNAME: "security-user",
      INTERNAL_ACCESS_PASSWORD: "security-password-123",
      INTERNAL_REPORT_SIGNING_SECRET:
        "security-report-signing-secret-at-least-32-bytes",
    },
  },
});
