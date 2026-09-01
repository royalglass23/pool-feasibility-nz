import { afterEach, describe, expect, it, vi } from "vitest";

const loadFastPropertyStages = vi.hoisted(() => vi.fn());
const executeFastPropertyDetailsRequest = vi.hoisted(() => vi.fn());
const verifyAssessmentSnapshot = vi.hoisted(() => vi.fn());
const assertSnapshotAddressMatches = vi.hoisted(() => vi.fn());
const refreshAssessmentSnapshot = vi.hoisted(() => vi.fn());
const enforcePublicPropertyStageRateLimit = vi.hoisted(() => vi.fn());
const AssessmentSnapshotValidationError = vi.hoisted(
  () => class AssessmentSnapshotValidationError extends Error {},
);
const selectedAddressPoint = {
  addressId: "987057",
  coordinates: [174.63963545, -36.81171243],
} as const;

vi.mock("server-only", () => ({}));
vi.mock("@/modules/data-access-spike/fast-property-view", () => ({
  loadFastPropertyStages,
}));
vi.mock("@/modules/data-access-spike/execute-fast-property-details", () => ({
  executeFastPropertyDetailsRequest,
}));
vi.mock("@/modules/providers/official-gis-gateway", () => ({
  OfficialGisGateway: vi.fn(),
}));
vi.mock("@/modules/assessment/assessment-snapshot", () => ({
  assertSnapshotAddressMatches,
  AssessmentSnapshotValidationError,
  refreshAssessmentSnapshot,
  verifyAssessmentSnapshot,
}));
vi.mock("@/modules/rate-limit/public-rate-limit", () => ({
  enforcePublicPropertyStageRateLimit,
}));

import { POST } from "@/app/api/internal/fast-property-view/stages/route";
import { POST as POST_PUBLIC } from "@/app/api/public/property-check/stages/route";

afterEach(() => {
  loadFastPropertyStages.mockReset();
  executeFastPropertyDetailsRequest.mockReset();
  verifyAssessmentSnapshot.mockReset();
  assertSnapshotAddressMatches.mockReset();
  refreshAssessmentSnapshot.mockReset();
  enforcePublicPropertyStageRateLimit.mockReset();
  vi.unstubAllEnvs();
});

describe("POST /api/internal/fast-property-view/stages", () => {
  it("rate-limits a public snapshot replay before starting provider work", async () => {
    verifyAssessmentSnapshot.mockReturnValue({
      submissionId: "snapshot-id",
      fastResult: {},
      expiresAt: Date.now() + 60_000,
    });
    enforcePublicPropertyStageRateLimit.mockResolvedValue(
      Response.json(
        {
          error: { code: "RATE_LIMITED", message: "Please try again shortly." },
        },
        { status: 429 },
      ),
    );

    const response = await POST_PUBLIC(
      new Request("https://pool.example/api/public/property-check/stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...selectedAddressPoint,
          assessmentSnapshot: "s".repeat(2_000),
        }),
      }),
    );

    expect(response.status).toBe(429);
    expect(enforcePublicPropertyStageRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ submissionId: "snapshot-id" }),
    );
    expect(loadFastPropertyStages).not.toHaveBeenCalled();
    expect(executeFastPropertyDetailsRequest).not.toHaveBeenCalled();
  });

  it("loads detailed checks through the public stage route after rate limiting", async () => {
    const detailedData = { datasets: {}, durationMs: 10 };
    verifyAssessmentSnapshot.mockReturnValue({
      submissionId: "snapshot-id",
      fastResult: {},
      expiresAt: Date.now() + 60_000,
    });
    enforcePublicPropertyStageRateLimit.mockResolvedValue(null);
    executeFastPropertyDetailsRequest.mockResolvedValue({
      ok: true,
      status: 200,
      data: detailedData,
    });
    refreshAssessmentSnapshot.mockReturnValue("refreshed-detailed-snapshot");

    const response = await POST_PUBLIC(
      new Request("https://pool.example/api/public/property-check/stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...selectedAddressPoint,
          mode: "detailed",
          assessmentSnapshot: "s".repeat(2_000),
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(enforcePublicPropertyStageRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ submissionId: "snapshot-id" }),
    );
    expect(executeFastPropertyDetailsRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { ...selectedAddressPoint, mode: "detailed" },
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      data: detailedData,
      assessmentSnapshot: "refreshed-detailed-snapshot",
    });
  });

  it("identifies malformed stage requests without starting imagery", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const response = await POST(
      new Request(
        "http://127.0.0.1:3000/api/internal/fast-property-view/stages",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{not valid JSON}",
        },
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "INVALID_REQUEST",
        message:
          "The property imagery request is invalid. Search for the address again.",
      },
    });
    expect(loadFastPropertyStages).not.toHaveBeenCalled();
  });

  it("identifies non-object stage requests without starting imagery", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const response = await POST(
      new Request(
        "http://127.0.0.1:3000/api/internal/fast-property-view/stages",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(null),
        },
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "INVALID_REQUEST",
        message:
          "The property imagery request is invalid. Search for the address again.",
      },
    });
    expect(loadFastPropertyStages).not.toHaveBeenCalled();
  });

  it("identifies a missing assessment snapshot without starting imagery", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const response = await POST(
      new Request(
        "http://127.0.0.1:3000/api/internal/fast-property-view/stages",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...selectedAddressPoint,
          }),
        },
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "MISSING_ASSESSMENT_SNAPSHOT",
        message:
          "The property view session is missing. Search for the address again.",
      },
    });
    expect(loadFastPropertyStages).not.toHaveBeenCalled();
  });

  it("identifies an invalid selected address point without starting imagery", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const response = await POST(
      new Request(
        "http://127.0.0.1:3000/api/internal/fast-property-view/stages",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...selectedAddressPoint,
            addressId: "",
            assessmentSnapshot: "s".repeat(32),
          }),
        },
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "INVALID_ADDRESS_POINT",
        message:
          "The selected address point is incomplete. Search for the address again.",
      },
    });
    expect(loadFastPropertyStages).not.toHaveBeenCalled();
  });

  it("identifies an invalid assessment snapshot without starting imagery", async () => {
    vi.stubEnv("NODE_ENV", "development");
    verifyAssessmentSnapshot.mockImplementation(() => {
      throw new AssessmentSnapshotValidationError();
    });

    const response = await POST(
      new Request(
        "http://127.0.0.1:3000/api/internal/fast-property-view/stages",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...selectedAddressPoint,
            assessmentSnapshot: "s".repeat(32),
          }),
        },
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "INVALID_ASSESSMENT_SNAPSHOT",
        message:
          "The property assessment has expired or is invalid. Search for the address again.",
      },
    });
    expect(loadFastPropertyStages).not.toHaveBeenCalled();
  });

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
    loadFastPropertyStages.mockResolvedValue(stageData);
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
            ...selectedAddressPoint,
            assessmentSnapshot: "s".repeat(2_000),
          }),
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(loadFastPropertyStages).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toMatchObject({
      data: stageData,
      assessmentSnapshot: "refreshed-stage-snapshot",
    });
  });

  it("keeps detailed mode on the detailed-stage request", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const detailedData = { datasets: {}, durationMs: 10 };
    executeFastPropertyDetailsRequest.mockResolvedValue({
      ok: true,
      status: 200,
      data: detailedData,
    });
    verifyAssessmentSnapshot.mockReturnValue({
      submissionId: "snapshot-id",
      fastResult: {},
      expiresAt: Date.now() + 60_000,
    });
    refreshAssessmentSnapshot.mockReturnValue("refreshed-detailed-snapshot");

    const response = await POST(
      new Request(
        "http://127.0.0.1:3000/api/internal/fast-property-view/stages",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...selectedAddressPoint,
            mode: "detailed",
            assessmentSnapshot: "s".repeat(2_000),
          }),
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(executeFastPropertyDetailsRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { ...selectedAddressPoint, mode: "detailed" },
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      data: detailedData,
      assessmentSnapshot: "refreshed-detailed-snapshot",
    });
  });
});
