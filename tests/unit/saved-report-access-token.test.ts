import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createSavedReportAccessTokenService } from "@/modules/reporting/saved-report-access-token";

describe("saved report access token", () => {
  const key = "saved-report-access-token-test-key-32-bytes";
  const issuedAt = Date.parse("2026-08-10T00:00:00.000Z");

  it("binds an expiring token to one saved assessment and reference", () => {
    const service = createSavedReportAccessTokenService(key, () => issuedAt);
    const token = service.issue({
      assessmentId: "d6bfe050-bd85-4682-8f16-7c3ca4fd4c48",
      reference: "GF-2026-000123",
    });

    expect(service.verify(token)).toEqual({
      assessmentId: "d6bfe050-bd85-4682-8f16-7c3ca4fd4c48",
      reference: "GF-2026-000123",
    });
  });

  it("rejects tampering and expiry", () => {
    let now = issuedAt;
    const service = createSavedReportAccessTokenService(key, () => now);
    const token = service.issue({
      assessmentId: "d6bfe050-bd85-4682-8f16-7c3ca4fd4c48",
      reference: "GF-2026-000123",
    });

    expect(() => service.verify(`${token}x`)).toThrow(
      "INVALID_SAVED_REPORT_ACCESS_TOKEN",
    );
    now += 61 * 60 * 1_000;
    expect(() => service.verify(token)).toThrow(
      "INVALID_SAVED_REPORT_ACCESS_TOKEN",
    );
  });

  it("uses the existing Resend key when no dedicated report-token key is set", async () => {
    vi.stubEnv("INTERNAL_REPORT_SIGNING_SECRET", "");
    vi.stubEnv("RESEND_API_KEY", "re_test_existing_delivery_key_1234567890");
    vi.resetModules();
    const { issueSavedReportAccessToken, verifySavedReportAccessToken } =
      await import("@/modules/reporting/saved-report-access-token");
    const access = {
      assessmentId: "d6bfe050-bd85-4682-8f16-7c3ca4fd4c48",
      reference: "GF-2026-000123",
    };

    expect(verifySavedReportAccessToken(issueSavedReportAccessToken(access))).toEqual(
      access,
    );
  });
});
