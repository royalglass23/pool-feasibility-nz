import { afterEach, describe, expect, it, vi } from "vitest";

const executeFastPropertyStagesRequest = vi.hoisted(() => vi.fn());
const executeFastPropertyDetailsRequest = vi.hoisted(() => vi.fn());
const verifyAssessmentSnapshot = vi.hoisted(() => vi.fn());
const assertSnapshotAddressMatches = vi.hoisted(() => vi.fn());
const refreshAssessmentSnapshot = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock(
  "@/modules/data-access-spike/execute-fast-property-stages-request",
  () => ({
    executeFastPropertyStagesRequest,
  }),
);
vi.mock("@/modules/data-access-spike/execute-fast-property-details", () => ({
  executeFastPropertyDetailsRequest,
}));
vi.mock("@/modules/providers/official-gis-gateway", () => ({
  OfficialGisGateway: vi.fn(),
}));
vi.mock("@/modules/assessment/assessment-snapshot", () => ({
  assertSnapshotAddressMatches,
  AssessmentSnapshotValidationError: class AssessmentSnapshotValidationError extends Error {},
  refreshAssessmentSnapshot,
  verifyAssessmentSnapshot,
}));

import { POST } from "@/app/api/internal/fast-property-view/stages/route";

afterEach(() => {
  executeFastPropertyStagesRequest.mockReset();
  executeFastPropertyDetailsRequest.mockReset();
  verifyAssessmentSnapshot.mockReset();
  assertSnapshotAddressMatches.mockReset();
  refreshAssessmentSnapshot.mockReset();
  vi.unstubAllEnvs();
});

describe("POST /api/internal/fast-property-view/stages", () => {
  it("accepts a signed snapshot larger than the request metadata", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const stageData = {
      boundary: {
        state: "confirmed",
        geometry: null,
        areaSquareMetres: 705,
        parcelId: "4995742",
      },
      aerial: { state: "unavailable", durationMs: null, attribution: null },
      datasets: { legal_parcel: null, aerial_imagery: null },
      progress: {
        address: "found",
        boundary: "found",
        aerial: "unavailable",
        detailedChecks: "not_loaded",
      },
      fastPathDurationMs: 10,
    };
    executeFastPropertyStagesRequest.mockResolvedValue({
      ok: true,
      status: 200,
      data: stageData,
    });
    verifyAssessmentSnapshot.mockReturnValue({
      submissionId: "snapshot-id",
      fastResult: {},
      expiresAt: Date.now() + 60_000,
    });
    refreshAssessmentSnapshot.mockReturnValue("refreshed-stage-snapshot");

    const response = await POST(
      new Request(
        "http://127.0.0.1:3000/api/internal/fast-property-view/stages",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            addressId: "987057",
            coordinates: [174.63963545, -36.81171243],
            assessmentSnapshot: "s".repeat(2_000),
          }),
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(executeFastPropertyStagesRequest).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toMatchObject({
      data: stageData,
      assessmentSnapshot: "refreshed-stage-snapshot",
    });
  });
});
