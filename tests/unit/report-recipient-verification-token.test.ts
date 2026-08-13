import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createReportRecipientVerificationTokenService } from "@/modules/reporting/report-recipient-verification-token";

describe("report recipient verification token", () => {
  const key = "report-recipient-verification-test-key-32-bytes";
  const issuedAt = Date.parse("2026-08-13T00:00:00.000Z");
  const access = {
    assessmentId: "d6bfe050-bd85-4682-8f16-7c3ca4fd4c48",
    reference: "GF-2026-000123",
  };

  it("binds the verification capability to one report and its purpose", () => {
    const service = createReportRecipientVerificationTokenService(
      key,
      () => issuedAt,
    );
    expect(service.verify(service.issue(access))).toEqual(access);
  });

  it("rejects tampering, byte-length mismatch, and expiry without a crypto error", () => {
    let now = issuedAt;
    const service = createReportRecipientVerificationTokenService(
      key,
      () => now,
    );
    const token = service.issue(access);

    expect(() => service.verify(`${token}x`)).toThrow(
      "INVALID_REPORT_RECIPIENT_VERIFICATION_TOKEN",
    );
    expect(() => service.verify(`${token.split(".")[0]}.é`)).toThrow(
      "INVALID_REPORT_RECIPIENT_VERIFICATION_TOKEN",
    );
    now += 61 * 60 * 1_000;
    expect(() => service.verify(token)).toThrow(
      "INVALID_REPORT_RECIPIENT_VERIFICATION_TOKEN",
    );
  });
});
