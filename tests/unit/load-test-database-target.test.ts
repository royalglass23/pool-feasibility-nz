import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveLoadTestDatabaseTarget } from "../../scripts/load-test-database-target.mjs";

const developmentUrl =
  "postgresql://dev-user:secret@ep-development-pooler.example.test/devdb";
const productionUrl =
  "postgresql://prod-user:secret@ep-production.example.test/proddb";

describe("load-test database target guard", () => {
  it("loads in the native Node ESM runtime used by the load-test scripts", () => {
    const moduleUrl = pathToFileURL(
      resolve("scripts/load-test-database-target.mjs"),
    ).href;

    expect(() =>
      execFileSync(
        process.execPath,
        [
          "--input-type=module",
          "--eval",
          `await import(${JSON.stringify(moduleUrl)})`,
        ],
        { stdio: "pipe" },
      ),
    ).not.toThrow();
  });

  it.each([".env.production.local", ".env.local", ".env.production", ".env"])(
    "rejects a development target matching production in %s",
    (environmentFile) => {
      expect(() =>
        resolveLoadTestDatabaseTarget({
          combinedEnv: {
            DATABASE_URL_DEV: developmentUrl,
            DATABASE_URL: productionUrl,
          },
          loadedEnvFiles: [
            {
              path: environmentFile,
              env: { DATABASE_URL_PROD: developmentUrl },
            },
          ],
        }),
      ).toThrow("DEVELOPMENT_DATABASE_NOT_DISTINCT");
    },
  );

  it("uses the effective process-environment development target", () => {
    const overriddenDevelopmentUrl =
      "postgresql://override:secret@ep-override-pooler.example.test/overridedb";

    expect(
      resolveLoadTestDatabaseTarget({
        combinedEnv: {
          DATABASE_URL_DEV: overriddenDevelopmentUrl,
          DATABASE_URL_PROD: productionUrl,
        },
        loadedEnvFiles: [
          {
            path: ".env.production.local",
            env: { DATABASE_URL_DEV: developmentUrl },
          },
        ],
      }),
    ).toEqual({
      databaseUrl: overriddenDevelopmentUrl,
      databaseIdentity: "ep-override.example.test/overridedb",
    });
  });

  it("fails closed when no production database target is configured", () => {
    expect(() =>
      resolveLoadTestDatabaseTarget({
        combinedEnv: { DATABASE_URL_DEV: developmentUrl },
        loadedEnvFiles: [],
      }),
    ).toThrow("PRODUCTION_DATABASE_TARGET_REQUIRED");
  });

  it("fails closed when a configured production target cannot be identified", () => {
    expect(() =>
      resolveLoadTestDatabaseTarget({
        combinedEnv: {
          DATABASE_URL_DEV: developmentUrl,
          DATABASE_URL_PROD: "not-a-database-url",
        },
        loadedEnvFiles: [],
      }),
    ).toThrow("PRODUCTION_DATABASE_URL_INVALID");
  });
});
