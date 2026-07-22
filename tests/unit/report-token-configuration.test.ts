import { afterEach, describe, expect, it, vi } from "vitest";

describe("default report-token configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("allows build-time module evaluation without a signing secret", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INTERNAL_REPORT_SIGNING_SECRET", "");
    vi.resetModules();

    await expect(
      import("@/modules/reporting/report-token"),
    ).resolves.toBeDefined();
  });

  it("fails closed when token issuance is attempted without a signing secret", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INTERNAL_REPORT_SIGNING_SECRET", "");
    vi.resetModules();
    const { issueSessionReportToken } =
      await import("@/modules/reporting/report-token");

    expect(() => issueSessionReportToken(undefined as never)).toThrow(
      "INTERNAL_REPORT_SIGNING_SECRET_REQUIRED",
    );
  });
});
