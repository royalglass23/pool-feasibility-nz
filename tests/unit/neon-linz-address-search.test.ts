import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createdDatabaseUrls = vi.hoisted(() => [] as string[]);

vi.mock("@neondatabase/serverless", () => ({
  neon: (databaseUrl: string) => {
    createdDatabaseUrls.push(databaseUrl);
    return vi.fn();
  },
}));

vi.mock("drizzle-orm/neon-http", () => ({
  drizzle: (sql: unknown) => sql,
}));

vi.mock("@/env", () => ({
  env: {
    DATABASE_URL: "postgres://production.example/persisted-assessments",
  },
}));

import {
  addressNumberFromQuery,
  addressTsQuery,
  NeonLinzAddressSearch,
} from "@/modules/address-search/neon-linz-address-search";
import { getDb } from "@/db/client";

afterEach(() => {
  createdDatabaseUrls.length = 0;
  vi.unstubAllEnvs();
});

describe("addressTsQuery", () => {
  it("keeps house suffixes distinct and creates prefix-token search", () => {
    expect(addressTsQuery("42A Bahari")).toBe("42a:* & bahari:*");
    expect(addressTsQuery("42 Bahari")).toBe("42:* & bahari:*");
  });

  it("normalizes whitespace and rejects an empty search", () => {
    expect(addressTsQuery("  Bahari   Drive ")).toBe("bahari:* & drive:*");
    expect(addressTsQuery("---")).toBeNull();
  });

  it("keeps an exact house number available for deterministic result ordering", () => {
    expect(addressNumberFromQuery("42A Bahari Drive")).toBe("42a");
    expect(addressNumberFromQuery("42 Bahari Drive")).toBe("42");
    expect(addressNumberFromQuery("Bahari Drive")).toBeNull();
  });

  it("uses the approved development database binding in Vercel Preview", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("DATABASE_URL_DEV", "postgres://preview.example/address-index");
    vi.stubEnv("DATABASE_URL", "postgres://production.example/address-index");

    new NeonLinzAddressSearch();

    expect(createdDatabaseUrls).toEqual([
      "postgres://preview.example/address-index",
    ]);
  });
});

describe("database environment bindings", () => {
  it("uses the approved development database binding for persisted assessments in Vercel Preview", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv(
      "DATABASE_URL_DEV",
      "postgres://preview.example/persisted-assessments",
    );

    getDb();

    expect(createdDatabaseUrls).toEqual([
      "postgres://preview.example/persisted-assessments",
    ]);
  });

  it("fails closed when the Preview database binding is missing", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("DATABASE_URL_DEV", "");

    expect(() => getDb()).toThrow(
      "DATABASE_URL_DEV is required for persisted assessments in Vercel Preview.",
    );
  });

  it("uses the primary database binding outside Vercel Preview", () => {
    vi.stubEnv("VERCEL_ENV", "production");

    getDb();

    expect(createdDatabaseUrls).toEqual([
      "postgres://production.example/persisted-assessments",
    ]);
  });
});
