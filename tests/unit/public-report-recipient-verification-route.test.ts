import { afterEach, describe, expect, it, vi } from "vitest";

const getDb = vi.hoisted(() => vi.fn(() => ({}) as never));
const getAssessmentDeliveryStateById = vi.hoisted(() => vi.fn());
const deliverAssessmentReportByReference = vi.hoisted(() => vi.fn());
const verifyReportRecipientVerificationToken = vi.hoisted(() => vi.fn());
const ReportRecipientVerificationTokenError = vi.hoisted(
  () => class ReportRecipientVerificationTokenError extends Error {},
);

vi.mock("server-only", () => ({}));
vi.mock("@/modules/rate-limit/public-rate-limit", () => ({
  createPublicRateLimitedHandler: (
    _action: string,
    next: (request: Request) => Promise<Response>,
  ) => next,
}));
vi.mock("@/db/client", () => ({ getDb }));
vi.mock("@/db/repositories/homeowner-assessment-repository", () => ({
  getAssessmentDeliveryStateById,
}));
vi.mock("@/modules/reporting/deliver-assessment-report", () => ({
  deliverAssessmentReportByReference,
}));
vi.mock("@/modules/reporting/report-recipient-verification-token", () => ({
  ReportRecipientVerificationTokenError,
  verifyReportRecipientVerificationToken,
}));

import { POST } from "@/app/api/public/assessments/report/verify/route";

afterEach(() => {
  getDb.mockClear();
  getAssessmentDeliveryStateById.mockReset();
  deliverAssessmentReportByReference.mockReset();
  verifyReportRecipientVerificationToken.mockReset();
});

describe("POST report recipient verification", () => {
  it("sends only after the signed verification token resolves to the same report", async () => {
    verifyReportRecipientVerificationToken.mockReturnValue({
      assessmentId: "d6bfe050-bd85-4682-8f16-7c3ca4fd4c48",
      reference: "GF-2026-000123",
    });
    getAssessmentDeliveryStateById
      .mockResolvedValueOnce({
        reference: "GF-2026-000123",
        delivery: { homeowner: "pending", internal_test_report: "pending" },
      })
      .mockResolvedValueOnce({
        reference: "GF-2026-000123",
        delivery: { homeowner: "sent", internal_test_report: "pending" },
      });
    deliverAssessmentReportByReference.mockResolvedValue({
      homeowner: "sent",
      internal_test_report: "unchanged",
    });

    const response = await POST(
      new Request("https://pool.example/api/public/assessments/report/verify", {
        method: "POST",
        body: JSON.stringify({ verificationToken: "v".repeat(40) }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      delivery: { homeowner: "sent", internal_test_report: "pending" },
    });
    expect(deliverAssessmentReportByReference).toHaveBeenCalledWith(
      "GF-2026-000123",
      { recipientVerified: true },
    );
  });

  it("rejects an invalid verification token before querying or sending", async () => {
    verifyReportRecipientVerificationToken.mockImplementation(() => {
      throw new ReportRecipientVerificationTokenError();
    });

    const response = await POST(
      new Request("https://pool.example/api/public/assessments/report/verify", {
        method: "POST",
        body: JSON.stringify({ verificationToken: "v".repeat(40) }),
      }),
    );

    expect(response.status).toBe(401);
    expect(getDb).not.toHaveBeenCalled();
    expect(deliverAssessmentReportByReference).not.toHaveBeenCalled();
  });

  it("does not send when the signed token is for a different saved report", async () => {
    verifyReportRecipientVerificationToken.mockReturnValue({
      assessmentId: "d6bfe050-bd85-4682-8f16-7c3ca4fd4c48",
      reference: "GF-2026-000999",
    });
    getAssessmentDeliveryStateById.mockResolvedValue({
      reference: "GF-2026-000123",
      delivery: { homeowner: "pending", internal_test_report: "pending" },
    });

    const response = await POST(
      new Request("https://pool.example/api/public/assessments/report/verify", {
        method: "POST",
        body: JSON.stringify({ verificationToken: "v".repeat(40) }),
      }),
    );

    expect(response.status).toBe(404);
    expect(deliverAssessmentReportByReference).not.toHaveBeenCalled();
  });
});
