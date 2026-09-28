import "dotenv/config";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const audienceCompatibilityOutput = resolve("tmp/audience-path-compatibility");
const audienceCompatibilityMailCapture = resolve(
  audienceCompatibilityOutput,
  "emails.jsonl",
);
mkdirSync(audienceCompatibilityOutput, { recursive: true });

const developmentDatabase = process.env.DATABASE_URL_DEV;
if (developmentDatabase) {
  const identity = (value: string) => {
    const url = new URL(value);
    return `${url.hostname.toLowerCase().replace(/-pooler(?=\.)/, "")}:${url.port || "5432"}/${decodeURIComponent(url.pathname.slice(1))}`;
  };
  for (const productionDatabase of [
    process.env.DATABASE_URL,
    process.env.DATABASE_URL_PROD,
  ]) {
    if (
      productionDatabase &&
      identity(developmentDatabase) === identity(productionDatabase)
    ) {
      throw new Error("E2E development database must differ from production.");
    }
  }
}

const providerFixture = pathToFileURL(
  resolve("tests/security/audience-compatibility-provider-fixture.mjs"),
).href;

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
      REPORT_DELIVERY_MODE: "synthetic_test",
      RESEND_API_KEY: "re_local_audience_compatibility_fixture",
      PREVIEW_REPORT_FROM_EMAIL: "audience-compatibility@example.test",
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: "",
      NODE_OPTIONS: `--import=${providerFixture}`,
      AUDIENCE_COMPATIBILITY_MAIL_CAPTURE: audienceCompatibilityMailCapture,
      PROVIDER_RETRY_COUNT: "0",
      PROVIDER_TIMEOUT_MS: "1000",
      ...(developmentDatabase
        ? {
            DATABASE_URL: developmentDatabase,
            DATABASE_URL_DEV: developmentDatabase,
          }
        : {}),
    },
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
