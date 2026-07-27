import { beforeEach, describe, expect, it, vi } from "vitest";

const executeConfiguredAssessmentRequest = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/modules/assessment/execute-configured-assessment-request", () => ({
  executeConfiguredAssessmentRequest,
}));
vi.mock("@/modules/assessment/build-session-assessment", () => ({
  buildSessionAssessment: vi.fn(() => ({ kind: "session-assessment" })),
}));
vi.mock("@/modules/reporting/report-token", () => ({
  issueSessionReportToken: vi.fn(() => "test-report-token"),
}));

import { POST } from "@/app/api/internal/data-access/route";

describe("POST /api/internal/data-access manual-review contract", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INTERNAL_ACCESS_USERNAME", "royal-glass");
    vi.stubEnv("INTERNAL_ACCESS_PASSWORD", "staff-secret");
    executeConfiguredAssessmentRequest.mockReset();
  });

  it("returns an identity-ambiguous parcel for manual review", async () => {
    executeConfiguredAssessmentRequest.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        parcelMatch: {
          status: "mapped_primary_parcel",
          reasons: ["selected parcel is shared by an address alternative"],
        },
        identityCheck: {
          exactAddressMatched: true,
          distinctFromAlternatives: false,
        },
        assessmentExplanation: "manual review required",
      },
    });

    const response = await POST(
      new Request("https://pool.example/api/internal/data-access", {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from("royal-glass:staff-secret").toString("base64")}`,
        },
        body: JSON.stringify({ address: "42A Bahari Drive, Ranui, Auckland" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        parcelMatch: { status: "mapped_primary_parcel" },
        identityCheck: { distinctFromAlternatives: false },
      },
      reportToken: "test-report-token",
    });
  });
});
