import { afterEach, describe, expect, it, vi } from "vitest";
import { TEST_MAP_IMAGE_DATA_URL } from "../fixtures/preliminary-report";
import { createAssessmentSnapshotService } from "@/modules/assessment/assessment-snapshot";
import {
  buildServerAssessmentSubmission,
  parseBrowserAssessmentSaveRequest,
} from "@/modules/assessment/server-assessment-submission";
import { queryableDatasetKeys } from "@/modules/data-access-spike/dataset-catalog";
import type { FastPropertyDetails } from "@/modules/data-access-spike/execute-fast-property-details";

const getDb = vi.hoisted(() => vi.fn(() => ({}) as never));
const saveHomeownerAssessment = vi.hoisted(() => vi.fn());
const getSavedPreliminaryReportById = vi.hoisted(() => vi.fn());
const deliverAssessmentReportByReference = vi.hoisted(() => vi.fn());
const scheduledCallbacks = vi.hoisted(
  () => [] as Array<() => void | Promise<void>>,
);

vi.mock("server-only", () => ({}));
vi.mock("@/modules/rate-limit/public-rate-limit", () => ({
  createPublicRateLimitedHandler: (
    _action: string,
    next: (request: Request) => Promise<Response>,
  ) => next,
}));
vi.mock("next/server", () => ({
  after: (callback: () => void | Promise<void>) => {
    scheduledCallbacks.push(callback);
  },
}));
vi.mock("@/db/client", () => ({ getDb }));
vi.mock("@/db/repositories/homeowner-assessment-repository", () => ({
  getSavedPreliminaryReportById,
  saveHomeownerAssessment,
}));
vi.mock("@/modules/reporting/deliver-assessment-report", () => ({
  deliverAssessmentReportByReference,
}));

import { POST } from "@/app/api/internal/assessments/route";
import { POST as POST_PUBLIC } from "@/app/api/public/assessments/route";

const snapshotSigningKey = "test-assessment-snapshot-signing-key-32-bytes";
const snapshotService = createAssessmentSnapshotService(snapshotSigningKey);
const ASSESSMENT_ID = "d6bfe050-bd85-4682-8f16-7c3ca4fd4c48";
const validSubmission = {
  assessmentSnapshot: snapshotService.issue({
    requestedAddress: "1 Test Street, Auckland",
    resolvedAddress: {
      addressId: "linz-123",
      fullAddress: "1 Test Street, Auckland",
      fullAddressNumber: "1 Test Street",
      unit: null,
      territorialAuthority: "Auckland",
      coordinates: [174.76, -36.85],
    },
    boundary: {
      state: "confirmed",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [174.75, -36.86],
            [174.77, -36.86],
            [174.77, -36.84],
            [174.75, -36.84],
            [174.75, -36.86],
          ],
        ],
      },
      areaSquareMetres: 900,
      parcelId: "parcel-123",
    },
    aerial: { state: "unavailable", durationMs: null, attribution: null },
    datasets: { legal_parcel: null, aerial_imagery: null },
    defaultPool: {
      id: "compact",
      label: "Compact",
      lengthMetres: 6.5,
      widthMetres: 3,
    },
    progress: {
      address: "found",
      boundary: "found",
      aerial: "unavailable",
      detailedChecks: "not_loaded",
    },
    firstUsableViewStartedAt: "2026-07-29T01:00:00.000Z",
    fastPathDurationMs: 10,
  }),
  mapImageDataUrl: TEST_MAP_IMAGE_DATA_URL,
  mapVisibleLayerKeys: ["wastewater_assets"],
  homeowner: {
    name: "Jane Homeowner",
    phone: "021 555 1234",
    email: "jane@example.com",
    visitorType: "homeowner",
    desiredTiming: "3_months",
    consentGiven: true,
  },
  poolLayout: {
    lengthMetres: 6.5,
    widthMetres: 3,
    rotationDegrees: 12,
    position: [174.76, -36.85],
  },
};

afterEach(() => {
  getDb.mockClear();
  saveHomeownerAssessment.mockReset();
  getSavedPreliminaryReportById.mockReset();
  deliverAssessmentReportByReference.mockReset();
  scheduledCallbacks.length = 0;
  vi.unstubAllEnvs();
});

describe("POST /api/internal/assessments", () => {
  it("builds canonical saved facts from the server snapshot", async () => {
    const request = parseBrowserAssessmentSaveRequest(validSubmission);
    const snapshot = snapshotService.verify(request.assessmentSnapshot);

    await expect(
      buildServerAssessmentSubmission({
        request,
        snapshot,
        now: () => new Date("2026-07-30T00:00:00.000Z"),
      }),
    ).resolves.toMatchObject({
      idempotencyKey: snapshot.submissionId,
      addressEvidence: { selectedAddressId: "linz-123" },
      report: {
        mapImageDataUrl: TEST_MAP_IMAGE_DATA_URL,
        reportData: { mapImageSource: "fast_property_view_capture" },
      },
    });
  });

  it("rejects a browser map capture that is not a valid PNG", () => {
    expect(() =>
      parseBrowserAssessmentSaveRequest({
        ...validSubmission,
        mapImageDataUrl: "data:image/png;base64,not-a-real-png",
      }),
    ).toThrow();
  });

  it("persists a scored report with risks, actions, and missing information", async () => {
    const original = snapshotService.verify(validSubmission.assessmentSnapshot);
    const assessmentSnapshot = snapshotService.issue({
      ...original.fastResult,
      detailedChecks: completeDetailedChecks(),
    });
    const request = parseBrowserAssessmentSaveRequest({
      ...validSubmission,
      assessmentSnapshot,
    });
    const snapshot = snapshotService.verify(request.assessmentSnapshot);

    const submission = await buildServerAssessmentSubmission({
      request,
      snapshot,
      now: () => new Date("2026-07-30T00:00:00.000Z"),
    });

    expect(
      submission.report.reportData.assessmentSnapshot?.feasibilityAssessment
        .score,
    ).toEqual(expect.any(Number));
    expect(submission.report.reportData.risks.length).toBeGreaterThan(0);
    expect(submission.report.reportData.actions.length).toBeGreaterThan(0);
    expect(
      submission.report.reportData.missingInformation.length,
    ).toBeGreaterThan(0);
  });

  it("keeps non-reportable geometry out of the homeowner score", async () => {
    const original = snapshotService.verify(validSubmission.assessmentSnapshot);
    const detailedChecks = completeDetailedChecks();
    const wastewater = detailedChecks.layers.find(
      (layer) => layer.key === "wastewater_assets",
    );
    if (!wastewater) throw new Error("TEST_WASTEWATER_LAYER_MISSING");
    wastewater.state = "internal_reference_only";
    wastewater.evidence = {
      ...wastewater.evidence,
      provider: "Watercare",
      status: "success",
      licenceStatus: "conditional",
      evidenceUse: "internal_reference",
      licence: "CC BY-NC-ND 3.0 NZ",
      featureCount: 1,
    };
    wastewater.geometry = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: original.fastResult.boundary.geometry!,
        },
      ],
    };
    const floodPlain = detailedChecks.layers.find(
      (layer) => layer.key === "flood_plains",
    );
    if (!floodPlain) throw new Error("TEST_FLOOD_LAYER_MISSING");
    floodPlain.state = "returned";
    floodPlain.evidence = {
      ...floodPlain.evidence,
      provider: "Auckland Council",
      status: "success",
      licenceStatus: "conditional",
      evidenceUse: "spike_only",
      licence: "Generated-report reuse not approved",
      featureCount: 1,
    };
    floodPlain.geometry = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: original.fastResult.boundary.geometry!,
        },
      ],
    };
    const assessmentSnapshot = snapshotService.issue({
      ...original.fastResult,
      detailedChecks,
    });
    const request = parseBrowserAssessmentSaveRequest({
      ...validSubmission,
      assessmentSnapshot,
    });
    const snapshot = snapshotService.verify(request.assessmentSnapshot);

    const submission = await buildServerAssessmentSubmission({
      request,
      snapshot,
      now: () => new Date("2026-07-30T00:00:00.000Z"),
    });
    const assessment =
      submission.report.reportData.assessmentSnapshot?.feasibilityAssessment;

    expect(
      submission.layerStates.find(
        (layer) => layer.datasetId === "wastewater_assets",
      )?.geometry,
    ).toMatchObject({
      type: "GeometryCollection",
      geometries: [expect.objectContaining({ type: "Polygon" })],
    });

    expect(assessment?.criticalFlags).not.toContainEqual(
      expect.objectContaining({ id: "major_mapped_infrastructure" }),
    );
    expect(assessment?.criticalFlags).not.toContainEqual(
      expect.objectContaining({ id: "all_candidates_flood_affected" }),
    );
    expect(assessment?.categories).toContainEqual(
      expect.objectContaining({
        id: "underground_services",
        awardedPoints: null,
        status: "unknown",
      }),
    );
    expect(assessment?.categories).toContainEqual(
      expect.objectContaining({
        id: "flooding_and_drainage",
        awardedPoints: null,
        status: "unknown",
      }),
    );
  });

  it("rejects a pool position outside the signed property boundary", async () => {
    const request = parseBrowserAssessmentSaveRequest({
      ...validSubmission,
      poolLayout: { ...validSubmission.poolLayout, position: [174.7, -36.8] },
    });
    const snapshot = snapshotService.verify(request.assessmentSnapshot);

    await expect(
      buildServerAssessmentSubmission({ request, snapshot }),
    ).rejects.toThrow("INVALID_ASSESSMENT_SUBMISSION");
  });

  it("rejects a pool position outside a provisional mapped property boundary", async () => {
    const original = snapshotService.verify(validSubmission.assessmentSnapshot);
    const assessmentSnapshot = snapshotService.issue({
      ...original.fastResult,
      boundary: {
        ...original.fastResult.boundary,
        state: "provisional",
      },
      progress: {
        ...original.fastResult.progress,
        boundary: "provisional",
      },
    });
    const request = parseBrowserAssessmentSaveRequest({
      ...validSubmission,
      assessmentSnapshot,
      poolLayout: { ...validSubmission.poolLayout, position: [174.7, -36.8] },
    });
    const snapshot = snapshotService.verify(request.assessmentSnapshot);

    await expect(
      buildServerAssessmentSubmission({ request, snapshot }),
    ).rejects.toThrow("INVALID_ASSESSMENT_SUBMISSION");
  });

  it("rejects non-loopback requests when internal access is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INTERNAL_ACCESS_USERNAME", "");
    vi.stubEnv("INTERNAL_ACCESS_PASSWORD", "");

    const response = await POST(
      new Request("https://pool.example/api/internal/assessments", {
        method: "POST",
        body: JSON.stringify(validSubmission),
      }),
    );

    expect(response.status).toBe(503);
    expect(saveHomeownerAssessment).not.toHaveBeenCalled();
  });

  it("lets an anonymous deployed visitor reach public submission validation", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const response = await POST_PUBLIC(
      new Request("https://pool.example/api/public/assessments", {
        method: "POST",
        body: JSON.stringify({ ...validSubmission, homeowner: {} }),
      }),
    );

    expect(response.status).toBe(400);
    expect(getDb).not.toHaveBeenCalled();
    expect(saveHomeownerAssessment).not.toHaveBeenCalled();
  });

  it("rejects invalid submissions before opening the database", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("INTERNAL_REPORT_SIGNING_SECRET", snapshotSigningKey);

    const response = await POST(
      new Request("http://127.0.0.1:3000/api/internal/assessments", {
        method: "POST",
        body: JSON.stringify({ ...validSubmission, homeowner: {} }),
      }),
    );

    expect(response.status).toBe(400);
    expect(getDb).not.toHaveBeenCalled();
    expect(saveHomeownerAssessment).not.toHaveBeenCalled();
  });

  it("requires details for browser selections marked Other", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("INTERNAL_REPORT_SIGNING_SECRET", snapshotSigningKey);

    const response = await POST(
      new Request("http://127.0.0.1:3000/api/internal/assessments", {
        method: "POST",
        body: JSON.stringify({
          ...validSubmission,
          homeowner: {
            ...validSubmission.homeowner,
            visitorType: "other",
            desiredTiming: "other",
          },
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(getDb).not.toHaveBeenCalled();
    expect(saveHomeownerAssessment).not.toHaveBeenCalled();
  });

  it("rejects whitespace-only details for browser selections marked Other", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("INTERNAL_REPORT_SIGNING_SECRET", snapshotSigningKey);

    const response = await POST(
      new Request("http://127.0.0.1:3000/api/internal/assessments", {
        method: "POST",
        body: JSON.stringify({
          ...validSubmission,
          homeowner: {
            ...validSubmission.homeowner,
            visitorType: "other",
            visitorTypeOtherDetail: " \t ",
            desiredTiming: "other",
            desiredTimingOtherDetail: "\n",
          },
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(getDb).not.toHaveBeenCalled();
    expect(saveHomeownerAssessment).not.toHaveBeenCalled();
  });

  it("rejects browser-authored assessment facts without a server snapshot", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("INTERNAL_REPORT_SIGNING_SECRET", snapshotSigningKey);

    const response = await POST(
      new Request("http://127.0.0.1:3000/api/internal/assessments", {
        method: "POST",
        body: JSON.stringify({
          ...validSubmission,
          assessmentSnapshot: "not-a-server-snapshot",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(getDb).not.toHaveBeenCalled();
    expect(saveHomeownerAssessment).not.toHaveBeenCalled();
  });

  it("persists a validated server snapshot", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("INTERNAL_REPORT_SIGNING_SECRET", snapshotSigningKey);
    saveHomeownerAssessment.mockResolvedValue({
      assessment: {
        id: ASSESSMENT_ID,
        reference: "GF-2026-000001",
        status: "new_enquiry",
        createdAt: new Date("2026-07-29T02:03:04.000Z"),
        emailDeliveryState: "pending",
        forwardingState: "pending",
      },
      created: true,
    });
    getSavedPreliminaryReportById.mockResolvedValue({
      reference: "GF-2026-000001",
      generatedAt: "2026-07-29T02:03:04.000Z",
      title: "Stored preliminary report",
      summary: "The original persisted assessment.",
      warningState: "blocked",
      property: {
        address: "Stored address",
        boundaryStatus: "confirmed",
        boundaryConfidence: "high",
        boundaryAreaSquareMetres: 900,
        parcelIdentifier: null,
      },
      pool: {
        lengthMetres: 6.5,
        widthMetres: 3,
        rotationDegrees: 12,
      },
      warnings: [],
      recommendations: [],
      layers: [],
      limitations: [],
      mapImageDataUrl: TEST_MAP_IMAGE_DATA_URL,
    });
    deliverAssessmentReportByReference.mockRejectedValue(
      new Error("email provider unavailable"),
    );

    const response = await POST(
      new Request("http://127.0.0.1:3000/api/internal/assessments", {
        method: "POST",
        headers: { "x-correlation-id": "mt-248-test" },
        body: JSON.stringify(validSubmission),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      assessment: {
        id: ASSESSMENT_ID,
        reference: "GF-2026-000001",
        status: "new_enquiry",
        created: true,
        report: expect.objectContaining({
          reference: "GF-2026-000001",
          warningState: "blocked",
          summary: "The original persisted assessment.",
          mapImageDataUrl: TEST_MAP_IMAGE_DATA_URL,
        }),
        reportAccessToken: expect.any(String),
        delivery: {
          homeowner: "pending",
          internal_test_report: "pending",
        },
      },
    });
    expect(response.headers.get("x-correlation-id")).toBe("mt-248-test");
    expect(saveHomeownerAssessment).toHaveBeenCalledOnce();
    expect(getSavedPreliminaryReportById).toHaveBeenCalledWith(
      expect.anything(),
      ASSESSMENT_ID,
    );
    expect(saveHomeownerAssessment).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        idempotencyKey: expect.any(String),
      }),
    );
    expect(deliverAssessmentReportByReference).not.toHaveBeenCalled();
    expect(scheduledCallbacks).toHaveLength(1);

    await expect(scheduledCallbacks[0]()).resolves.toBeUndefined();

    expect(deliverAssessmentReportByReference).toHaveBeenCalledWith(
      "GF-2026-000001",
    );
  });

  it("rejects a replayed server snapshot", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("INTERNAL_REPORT_SIGNING_SECRET", snapshotSigningKey);
    saveHomeownerAssessment.mockResolvedValue({
      assessment: {
        id: "assessment-1",
        reference: "GF-2026-000001",
        status: "new_enquiry",
        emailDeliveryState: "pending",
        forwardingState: "pending",
      },
      created: false,
    });

    const response = await POST(
      new Request("http://127.0.0.1:3000/api/internal/assessments", {
        method: "POST",
        body: JSON.stringify(validSubmission),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ASSESSMENT_SNAPSHOT_ALREADY_USED" },
    });
    expect(getSavedPreliminaryReportById).not.toHaveBeenCalled();
    expect(deliverAssessmentReportByReference).not.toHaveBeenCalled();
  });
});

function completeDetailedChecks(): FastPropertyDetails {
  const retrievedAt = "2026-07-29T01:00:00.000Z";
  return {
    status: "complete" as const,
    retrievedAt,
    durationMs: 10,
    region: "Auckland",
    limitations: ["Mapped evidence requires onsite verification."],
    layers: [...queryableDatasetKeys, "culverts" as const].map((key) => ({
      key,
      state: "verified_empty" as const,
      evidence: {
        provider: "Official test provider",
        dataset: key,
        datasetIdentifier: key,
        status: "success" as const,
        licenceStatus: "permitted" as const,
        evidenceUse: "report_allowed" as const,
        retrievedAt,
        datasetDate: null,
        licence: "Test licence",
        attribution: null,
        geometryUsed: "bounded query",
        attributesUsed: [],
        evidenceType: "vector",
        confidence: "limited" as const,
        featureCount: 0,
      },
      geometry: null,
      message: "The provider verified an empty result.",
    })),
  };
}
