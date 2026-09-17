import { describe, expect, it } from "vitest";
import {
  requireDevelopmentAddressSeed,
  requireFullAddressImport,
  resolveAddressIndexTarget,
} from "../../scripts/address-index-target";

describe("address-index command target", () => {
  it("uses the dedicated development database by default", () => {
    expect(
      resolveAddressIndexTarget({
        argv: [],
        env: { DATABASE_URL_DEV: "postgres://dev.example/index" },
      }),
    ).toEqual({
      target: "development",
      databaseUrl: "postgres://dev.example/index",
    });
  });

  it("requires an explicit, host-pinned production target", () => {
    const env = {
      DATABASE_URL_DEV: "postgres://dev.example/index",
      DATABASE_URL_PROD: "postgres://prod.example/index",
      ADDRESS_INDEX_PRODUCTION_HOST: "prod.example",
    };

    expect(() =>
      resolveAddressIndexTarget({ argv: ["--production"], env }),
    ).toThrow("CONFIRM_PRODUCTION_ADDRESS_INDEX_REQUIRED");
    expect(
      resolveAddressIndexTarget({
        argv: ["--production", "--confirm-production-address-index"],
        env,
      }),
    ).toEqual({
      target: "production",
      databaseUrl: "postgres://prod.example/index",
    });
  });

  it("refuses a production target that points at development or another host", () => {
    expect(() =>
      resolveAddressIndexTarget({
        argv: ["--production", "--confirm-production-address-index"],
        env: {
          DATABASE_URL_DEV: "postgres://same.example/index",
          DATABASE_URL_PROD: "postgres://same.example/index",
          ADDRESS_INDEX_PRODUCTION_HOST: "same.example",
        },
      }),
    ).toThrow("PRODUCTION_ADDRESS_INDEX_TARGET_MATCHES_DEVELOPMENT");
    expect(() =>
      resolveAddressIndexTarget({
        argv: ["--production", "--confirm-production-address-index"],
        env: {
          DATABASE_URL_PROD: "postgres://prod.example/index",
          ADDRESS_INDEX_PRODUCTION_HOST: "other.example",
        },
      }),
    ).toThrow("PRODUCTION_ADDRESS_INDEX_HOST_MISMATCH");
  });

  it("requires an explicit full-import flag for development and production", () => {
    expect(() => requireFullAddressImport([])).toThrow(
      "CONFIRM_FULL_ADDRESS_IMPORT_REQUIRED",
    );
    expect(() =>
      requireFullAddressImport([
        "--production",
        "--confirm-production-address-index",
      ]),
    ).toThrow("CONFIRM_FULL_ADDRESS_IMPORT_REQUIRED");
    expect(() => requireFullAddressImport(["--full"])).not.toThrow();
  });

  it("requires explicit confirmation before replacing the development seed", () => {
    expect(() => requireDevelopmentAddressSeed([])).toThrow(
      "CONFIRM_DEVELOPMENT_ADDRESS_SEED_REQUIRED",
    );
    expect(() =>
      requireDevelopmentAddressSeed(["--confirm-development-address-seed"]),
    ).not.toThrow();
  });
});
