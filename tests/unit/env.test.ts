// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("validated POC environment", () => {
  it("does not require a database configuration", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.resetModules();

    const { env } = await import("@/env");

    expect(env.DATABASE_URL).toBeUndefined();
  });
});
