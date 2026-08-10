import { afterEach, describe, expect, it, vi } from "vitest";
import { buildTestPreliminaryReport } from "../fixtures/preliminary-report";

const getDb = vi.hoisted(() => vi.fn(() => ({}) as never));
const getSavedPreliminaryReportById = vi.hoisted(() => vi.fn());
const getAssessmentDeliveryStateById = vi.hoisted(() => vi.fn());
const deliverAssessmentReportByReference = vi.hoisted(() => vi.fn());
const generatePreliminaryReportPdf = vi.hoisted(() => vi.fn());
const verifySavedReportAccessToken = vi.hoisted(() => vi.fn());
const ReportRendererBusyError = vi.hoisted(
  () => class ReportRendererBusyError extends Error {},
);
const ReportRendererTimeoutError = vi.hoisted(
  () => class ReportRendererTimeoutError extends Error {},
);
const SavedReportAccessTokenError = vi.hoisted(
  () =>
    class SavedReportAccessTokenError extends Error {
      constructor() {
        super("INVALID_SAVED_REPORT_ACCESS_TOKEN");
      }
    },
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
  getSavedPreliminaryReportById,
}));
vi.mock("@/modules/reporting/deliver-assessment-report", () => ({
  deliverAssessmentReportByReference,
}));
vi.mock("@/modules/reporting/report-renderer", () => ({
  generatePreliminaryReportPdf,
  ReportRendererBusyError,
  ReportRendererTimeoutError,
}));
vi.mock("@/modules/reporting/saved-report-access-token", () => ({
  SavedReportAccessTokenError,
  verifySavedReportAccessToken,
}));

import { POST } from "@/app/api/public/assessments/report/pdf/route";
import { POST as POST_DELIVERY } from "@/app/api/public/assessments/report/delivery/route";

const report = buildTestPreliminaryReport();

afterEach(() => {
  getDb.mockClear();
  getSavedPreliminaryReportById.mockReset();
  getAssessmentDeliveryStateById.mockReset();
  deliverAssessmentReportByReference.mockReset();
  generatePreliminaryReportPdf.mockReset();
  verifySavedReportAccessToken.mockReset();
});

describe("POST public saved report delivery", () => {
  it("delivers both pending channels and returns their durable state", async () => {
    verifySavedReportAccessToken.mockReturnValue({
      assessmentId: "d6bfe050-bd85-4682-8f16-7c3ca4fd4c48",
      reference: report.reference,
    });
    getAssessmentDeliveryStateById
      .mockResolvedValueOnce({
        reference: report.reference,
        delivery: {
          homeowner: "pending",
          internal_test_report: "pending",
        },
      })
      .mockResolvedValueOnce({
        reference: report.reference,
        delivery: { homeowner: "sent", internal_test_report: "sent" },
      });
    deliverAssessmentReportByReference.mockResolvedValue({
      homeowner: "sent",
      internal_test_report: "sent",
    });

    const response = await POST_DELIVERY(
      new Request(
        "https://pool.example/api/public/assessments/report/delivery",
        {
          method: "POST",
          body: JSON.stringify({
            accessToken: "valid-token-that-is-long-enough-for-validation",
          }),
        },
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      delivery: { homeowner: "sent", internal_test_report: "sent" },
    });
    expect(deliverAssessmentReportByReference).toHaveBeenCalledWith(
      report.reference,
    );
  });

  it("does not send when the token does not resolve to the same saved report", async () => {
    verifySavedReportAccessToken.mockReturnValue({
      assessmentId: "d6bfe050-bd85-4682-8f16-7c3ca4fd4c48",
      reference: "GF-2026-000999",
    });
    getAssessmentDeliveryStateById.mockResolvedValue({
      reference: report.reference,
      delivery: {
        homeowner: "pending",
        internal_test_report: "pending",
      },
    });

    const response = await POST_DELIVERY(
      new Request(
        "https://pool.example/api/public/assessments/report/delivery",
        {
          method: "POST",
          body: JSON.stringify({
            accessToken: "valid-token-that-is-long-enough-for-validation",
          }),
        },
      ),
    );

    expect(response.status).toBe(404);
    expect(deliverAssessmentReportByReference).not.toHaveBeenCalled();
  });
});

describe("POST public saved report PDF", () => {
  it("rejects malformed and oversized public requests before opening the database", async () => {
    const malformedResponse = await POST(
      new Request("https://pool.example/api/public/assessments/report/pdf", {
        method: "POST",
        body: JSON.stringify({
          accessToken: "valid-token-that-is-long-enough-for-validation",
          assessmentId: "attacker-controlled-object-id",
        }),
      }),
    );
    const oversizedResponse = await POST(
      new Request("https://pool.example/api/public/assessments/report/pdf", {
        method: "POST",
        body: JSON.stringify({ accessToken: "x".repeat(17_000) }),
      }),
    );

    expect(malformedResponse.status).toBe(400);
    expect(oversizedResponse.status).toBe(413);
    expect(getDb).not.toHaveBeenCalled();
  });

  it("rejects an invalid access token before opening the database", async () => {
    verifySavedReportAccessToken.mockImplementation(() => {
      throw new SavedReportAccessTokenError();
    });

    const response = await POST(
      new Request("https://pool.example/api/public/assessments/report/pdf", {
        method: "POST",
        body: JSON.stringify({
          accessToken: "invalid-token-that-is-long-enough-for-validation",
        }),
      }),
    );

    expect(response.status).toBe(401);
    expect(getDb).not.toHaveBeenCalled();
  });

  it("renders only the report bound to the verified token", async () => {
    verifySavedReportAccessToken.mockReturnValue({
      assessmentId: "d6bfe050-bd85-4682-8f16-7c3ca4fd4c48",
      reference: report.reference,
    });
    getSavedPreliminaryReportById.mockResolvedValue(report);
    generatePreliminaryReportPdf.mockResolvedValue(Buffer.from("%PDF-public"));

    const response = await POST(
      new Request("https://pool.example/api/public/assessments/report/pdf", {
        method: "POST",
        body: JSON.stringify({
          accessToken: "valid-token-that-is-long-enough-for-validation",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(getSavedPreliminaryReportById).toHaveBeenCalledWith(
      expect.anything(),
      "d6bfe050-bd85-4682-8f16-7c3ca4fd4c48",
    );
    expect(generatePreliminaryReportPdf).toHaveBeenCalledWith(report);
  });

  it("fails closed when the loaded report reference does not match the token", async () => {
    verifySavedReportAccessToken.mockReturnValue({
      assessmentId: "d6bfe050-bd85-4682-8f16-7c3ca4fd4c48",
      reference: "GF-2026-000999",
    });
    getSavedPreliminaryReportById.mockResolvedValue(report);

    const response = await POST(
      new Request("https://pool.example/api/public/assessments/report/pdf", {
        method: "POST",
        body: JSON.stringify({
          accessToken: "valid-token-that-is-long-enough-for-validation",
        }),
      }),
    );

    expect(response.status).toBe(404);
    expect(generatePreliminaryReportPdf).not.toHaveBeenCalled();
  });
});
