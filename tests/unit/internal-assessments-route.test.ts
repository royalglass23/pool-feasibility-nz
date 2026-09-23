import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_MAP_IMAGE_DATA_URL } from "../fixtures/preliminary-report";
import { createAssessmentSnapshotService } from "@/modules/assessment/assessment-snapshot";
import { handleSiteAnswersRequest } from "@/modules/assessment/handle-site-answers-request";
import {
  buildServerAssessmentSubmission,
  parseBrowserAssessmentSaveRequest,
} from "@/modules/assessment/server-assessment-submission";
import { queryableDatasetKeys } from "@/modules/data-access-spike/dataset-catalog";
import type { FastPropertyDetails } from "@/modules/data-access-spike/execute-fast-property-details";
import { officialDatasetEvidence } from "@/modules/providers/official-dataset-catalog";
import { AUCKLAND_DEM_REQUIRED_METADATA } from "@/modules/providers/linz/auckland-dem-source-contract";
import { buildSavedPreliminaryReport } from "@/modules/reporting/preliminary-report";
import { renderCanonicalPreliminaryReportHtml } from "@/modules/reporting/preliminary-report-html";

const getDb = vi.hoisted(() => vi.fn(() => ({}) as never));
const getHomeownerAssessmentByIdempotencyKey = vi.hoisted(() => vi.fn());
const saveHomeownerAssessment = vi.hoisted(() => vi.fn());
const getSavedPreliminaryReportById = vi.hoisted(() => vi.fn());
const issueSavedReportAccessToken = vi.hoisted(() => vi.fn());
const after = vi.hoisted(() => vi.fn());
const executeFastPropertyDetailsRequest = vi.hoisted(() => vi.fn());
const assessBufferedPoolTerrain = vi.hoisted(() => vi.fn());
const terrainReportPromotion = vi.hoisted(() => ({ enabled: false }));

vi.mock("server-only", () => ({}));
vi.mock(
  "@/modules/providers/linz/auckland-dem-source-contract",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/modules/providers/linz/auckland-dem-source-contract")
      >();
    return {
      ...actual,
      get AUCKLAND_DEM_HOMEOWNER_REPORT_APPROVED() {
        return terrainReportPromotion.enabled;
      },
    };
  },
);
vi.mock("next/server", () => ({ after }));
vi.mock("@/modules/rate-limit/public-rate-limit", () => ({
  createPublicRateLimitedHandler: (
    _action: string,
    next: (request: Request) => Promise<Response>,
  ) => next,
}));
vi.mock("@/db/client", () => ({ getDb }));
vi.mock("@/db/repositories/homeowner-assessment-repository", () => ({
  getHomeownerAssessmentByIdempotencyKey,
  getSavedPreliminaryReportById,
  saveHomeownerAssessment,
}));
vi.mock("@/modules/data-access-spike/execute-fast-property-details", () => ({
  executeFastPropertyDetailsRequest,
}));
vi.mock("@/modules/providers/linz/auckland-property-terrain-gateway", () => ({
  createAucklandPropertyTerrainGateway: () => ({
    assessParcel: assessBufferedPoolTerrain,
  }),
}));
vi.mock("@/modules/reporting/saved-report-access-token", () => ({
  issueSavedReportAccessToken,
}));

import { POST } from "@/app/api/internal/assessments/route";
import { POST as POST_PUBLIC } from "@/app/api/public/assessments/route";

const snapshotSigningKey = "test-assessment-snapshot-signing-key-32-bytes";
const snapshotService = createAssessmentSnapshotService(snapshotSigningKey);
const ASSESSMENT_ID = "d6bfe050-bd85-4682-8f16-7c3ca4fd4c48";
const unsignedValidAssessmentSnapshot = snapshotService.issue({
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
  datasets: {
    address_resolution: officialDatasetEvidence(
      "address_resolution",
      "2026-07-29T01:00:00.000Z",
    ),
    legal_parcel: null,
    aerial_imagery: null,
  },
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
});
const validSubmission = {
  assessmentSnapshot: snapshotService.attachReportAudience(
    snapshotService.verify(unsignedValidAssessmentSnapshot),
    "homeowner",
  ),
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

function issueTrustedAssessmentSnapshot(
  fastResult: Parameters<typeof snapshotService.issue>[0],
  constructability?: Parameters<typeof snapshotService.issue>[1],
) {
  const unsigned = snapshotService.issue(fastResult, constructability);
  return snapshotService.attachReportAudience(
    snapshotService.verify(unsigned),
    "homeowner",
  );
}

beforeEach(() => {
  terrainReportPromotion.enabled = false;
  assessBufferedPoolTerrain.mockResolvedValue({
    status: "needs_checking",
    reasons: ["The buffered pool area could not be assessed."],
  });
  getHomeownerAssessmentByIdempotencyKey.mockResolvedValue(null);
  executeFastPropertyDetailsRequest.mockResolvedValue({
    ok: true,
    status: 200,
    data: completeDetailedChecks(),
  });
});

afterEach(() => {
  getDb.mockClear();
  getHomeownerAssessmentByIdempotencyKey.mockReset();
  saveHomeownerAssessment.mockReset();
  getSavedPreliminaryReportById.mockReset();
  issueSavedReportAccessToken.mockReset();
  executeFastPropertyDetailsRequest.mockReset();
  assessBufferedPoolTerrain.mockReset();
  vi.unstubAllEnvs();
});

describe("POST /api/internal/assessments", () => {
  it("saves headline slope metrics assessed for the submitted buffered pool area", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("INTERNAL_REPORT_SIGNING_SECRET", snapshotSigningKey);
    terrainReportPromotion.enabled = true;
    const original = snapshotService.verify(validSubmission.assessmentSnapshot);
    const detailedChecks = completeDetailedChecks();
    detailedChecks.terrain = reportAllowedTerrain();
    const assessmentSnapshot = issueTrustedAssessmentSnapshot({
      ...original.fastResult,
      detailedChecks,
    });
    assessBufferedPoolTerrain.mockResolvedValue({
      ...reportAllowedTerrain(),
      averageSlopeDegrees: 16.7,
      upperSlopeDegrees: 19,
      estimatedFallMetres: 1.8,
      downhillBearingDegrees: 270,
      downhillDirection: "W",
    });
    saveHomeownerAssessment.mockResolvedValue({
      assessment: {
        id: ASSESSMENT_ID,
        reference: "GF-2026-000001",
        status: "new_enquiry",
        emailDeliveryState: "pending",
        forwardingState: "pending",
      },
      created: true,
    });
    getSavedPreliminaryReportById.mockResolvedValue({
      reference: "GF-2026-000001",
    });
    issueSavedReportAccessToken.mockReturnValue("saved-report-access-token");

    const response = await POST_PUBLIC(
      new Request("https://pool.example/api/public/assessments", {
        method: "POST",
        body: JSON.stringify({ ...validSubmission, assessmentSnapshot }),
      }),
    );

    expect(response.status).toBe(201);
    expect(assessBufferedPoolTerrain).toHaveBeenCalledWith(
      original.fastResult.boundary.geometry,
      expect.objectContaining({ type: "Polygon" }),
    );
    expect(saveHomeownerAssessment).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        report: expect.objectContaining({
          reportData: expect.objectContaining({
            terrain: expect.objectContaining({
              status: "measured",
              averageSlopeDegrees: 16.7,
              upperSlopeDegrees: 19,
              estimatedFallMetres: 1.8,
              downhillDirection: "W",
            }),
          }),
        }),
      }),
    );
  });
  it.each([
    { name: "Jane\u0000Smith" },
    { name: "Jane\r\nBcc:other@example.com" },
    { email: "jane@example.com\r\nBcc:other@example.com" },
    { additionalInfo: "text\u0000" },
    { visitorTypeOtherDetail: "text\u0000" },
    { desiredTimingOtherDetail: "text\u0000" },
    { phone: "0215551234<script>alert(1)</script>" },
    { name: "a".repeat(161) },
    { admin: true },
  ])("rejects unsafe contact input before database access", async (fields) => {
    const response = await POST_PUBLIC(
      new Request("https://pool.example/api/public/assessments", {
        method: "POST",
        body: JSON.stringify({
          ...validSubmission,
          homeowner: { ...validSubmission.homeowner, ...fields },
        }),
      }),
    );
    expect(response.status).toBe(400);
    expect(getDb).not.toHaveBeenCalled();
    expect(saveHomeownerAssessment).not.toHaveBeenCalled();
  });

  it("rejects a final save whose snapshot has no trusted report audience", async () => {
    const response = await POST_PUBLIC(
      new Request("https://pool.example/api/public/assessments", {
        method: "POST",
        body: JSON.stringify({
          ...validSubmission,
          assessmentSnapshot: unsignedValidAssessmentSnapshot,
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(getDb).not.toHaveBeenCalled();
    expect(getHomeownerAssessmentByIdempotencyKey).not.toHaveBeenCalled();
  });

  it("stops reading an oversized body without trusting content-length", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(1_000_000));
      },
      cancel,
    });
    const request = new Request("https://pool.example/api/public/assessments", {
      method: "POST",
      body,
      duplex: "half",
    } as RequestInit);
    const response = await POST_PUBLIC(request);
    expect(response.status).toBe(413);
    expect(cancel).toHaveBeenCalled();
    expect(getDb).not.toHaveBeenCalled();
  });

  it("returns a controlled error for an unreadable body", async () => {
    const request = new Request("https://pool.example/api/public/assessments", {
      method: "POST",
      body: new ReadableStream({
        start(controller) {
          controller.error(new Error("private transport failure"));
        },
      }),
      duplex: "half",
    } as RequestInit);
    const response = await POST_PUBLIC(request);
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("private transport failure");
    expect(getDb).not.toHaveBeenCalled();
  });

  it.each([
    "abcdefg",
    "0000000",
    "+61 412 345 678",
    "+64 21 555 1234",
    "6495551234",
  ])("rejects invalid phone %s at the request boundary", (phone) => {
    expect(() =>
      parseBrowserAssessmentSaveRequest({
        ...validSubmission,
        homeowner: { ...validSubmission.homeowner, phone },
      }),
    ).toThrow("Enter a valid NZ mobile or landline number starting with 0.");
  });

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

  it("persists the signed report audience and rejects a changed visitor type", async () => {
    const initial = snapshotService.verify(unsignedValidAssessmentSnapshot);
    const assessmentSnapshot = snapshotService.attachReportAudience(
      initial,
      "pool_builder",
    );
    const request = parseBrowserAssessmentSaveRequest({
      ...validSubmission,
      assessmentSnapshot,
      homeowner: {
        ...validSubmission.homeowner,
        visitorType: "pool_builder",
      },
    });
    const snapshot = snapshotService.verify(assessmentSnapshot);

    await expect(
      buildServerAssessmentSubmission({ request, snapshot }),
    ).resolves.toMatchObject({
      report: { reportData: { reportAudience: "pool_builder" } },
    });

    await expect(
      buildServerAssessmentSubmission({
        request: {
          ...request,
          homeowner: { ...request.homeowner, visitorType: "homeowner" },
        },
        snapshot,
      }),
    ).rejects.toThrow("INVALID_ASSESSMENT_SNAPSHOT");
  });

  it("round-trips submitted Site answers and trusted mapped evidence into the saved report", async () => {
    const baseSnapshot = snapshotService.verify(
      validSubmission.assessmentSnapshot,
    );
    const answers = {
      version: 1 as const,
      estimatedDepthMetres: 1.7,
      route: { provenance: "uncertain" as const, geometry: null },
      accessConditions: ["none_of_these" as const],
      nearbyFeatures: ["fences" as const],
    };
    const assessmentSnapshot = issueTrustedAssessmentSnapshot(
      baseSnapshot.fastResult,
      {
        answers,
        evidence: {
          suggestedRoute: null,
          mappedEvidence: [
            {
              id: "mapped-retaining-wall",
              category: "access_excavation",
              status: "concern",
              provider: "official-map",
              dataset: "retaining-walls",
            },
          ],
          providerAvailability: [
            {
              category: "access_excavation",
              provider: "official-map",
              dataset: "retaining-walls",
              status: "available",
            },
          ],
          assumptions: ["Onsite confirmation required."],
        },
      },
    );
    const request = parseBrowserAssessmentSaveRequest({
      ...validSubmission,
      assessmentSnapshot,
      constructability: answers,
    });
    const snapshot = snapshotService.verify(request.assessmentSnapshot);
    const submission = await buildServerAssessmentSubmission({
      request,
      snapshot,
    });
    snapshot.constructability!.evidence.mappedEvidence[0].id =
      "later-provider-change";
    const saved = buildSavedPreliminaryReport({
      submission,
      reference: "GF-2026-000001",
      createdAt: "2026-07-30T00:00:00.000Z",
    });

    expect(saved.constructability).toMatchObject({
      version: 1,
      estimatedDepthMetres: 1.7,
      overallStatus: "needs_checking",
      mappedEvidence: [{ id: "mapped-retaining-wall" }],
      userEvidence: [{ category: "barrier", condition: "fences" }],
    });
    expect(saved.overall.headline).toBe("Needs checking");
  });

  it("persists a confirmed suggested route and rejects a later change to the pool layout", async () => {
    const original = snapshotService.verify(validSubmission.assessmentSnapshot);
    const detailedChecks = completeDetailedChecks();
    detailedChecks.terrain = reportAllowedTerrain();
    const property = {
      ...original.fastResult,
      resolvedAddress: {
        ...original.fastResult.resolvedAddress,
        coordinates: [174.76015, -36.850005] as [number, number],
      },
      boundary: {
        ...original.fastResult.boundary,
        geometry: {
          type: "Polygon" as const,
          coordinates: [
            [
              [174.76, -36.85],
              [174.7603, -36.85],
              [174.7603, -36.8498],
              [174.76, -36.8498],
              [174.76, -36.85],
            ],
          ],
        },
      },
      detailedChecks,
    };
    const poolLayout = {
      ...validSubmission.poolLayout,
      position: [174.76015, -36.8499],
    };
    const response = await handleSiteAnswersRequest(
      new Request(
        "http://localhost/api/public/assessment-snapshot/site-answers",
        {
          method: "POST",
          body: JSON.stringify({
            assessmentSnapshot: issueTrustedAssessmentSnapshot(property),
            accessConditions: ["none_of_these"],
            nearbyFeatures: ["none_of_these"],
            routeResponse: "confirm",
            poolLayout,
          }),
        },
      ),
    );
    expect(response.status).toBe(200);
    const signed = await response.json();
    const request = parseBrowserAssessmentSaveRequest({
      ...validSubmission,
      assessmentSnapshot: signed.assessmentSnapshot,
      constructability: signed.answers,
      poolLayout,
    });
    const snapshot = snapshotService.verify(request.assessmentSnapshot);
    const submission = await buildServerAssessmentSubmission({
      request,
      snapshot,
    });
    expect(
      submission.report.reportData.constructability?.route.provenance,
    ).toBe("confirmed");
    expect(
      submission.report.reportData.constructability?.route.geometry,
    ).toEqual(snapshot.constructability?.evidence.suggestedRoute);
    const changed = parseBrowserAssessmentSaveRequest({
      ...request,
      poolLayout: { ...poolLayout, position: [174.7602, -36.8499] },
    });
    await expect(
      buildServerAssessmentSubmission({ request: changed, snapshot }),
    ).rejects.toThrow("INVALID_CONSTRUCTABILITY_ROUTE");
  });

  it("persists an uncertain route with no geometry when mapping cannot suggest access", async () => {
    const original = snapshotService.verify(validSubmission.assessmentSnapshot);
    const response = await handleSiteAnswersRequest(
      new Request(
        "http://localhost/api/public/assessment-snapshot/site-answers",
        {
          method: "POST",
          body: JSON.stringify({
            assessmentSnapshot: issueTrustedAssessmentSnapshot(
              original.fastResult,
            ),
            accessConditions: ["none_of_these"],
            nearbyFeatures: ["none_of_these"],
            routeResponse: "not_sure",
            poolLayout: validSubmission.poolLayout,
          }),
        },
      ),
    );
    expect(response.status).toBe(200);
    const signed = await response.json();
    const request = parseBrowserAssessmentSaveRequest({
      ...validSubmission,
      assessmentSnapshot: signed.assessmentSnapshot,
      constructability: signed.answers,
    });
    const snapshot = snapshotService.verify(request.assessmentSnapshot);
    const submission = await buildServerAssessmentSubmission({
      request,
      snapshot,
    });
    const saved = buildSavedPreliminaryReport({
      submission,
      reference: "GF-2026-000099",
      createdAt: "2026-07-30T00:00:00.000Z",
    });
    expect(saved.constructability.version).toBe(1);
    if (saved.constructability.version !== 1)
      throw new Error("Expected saved route evidence");
    expect(saved.constructability.route).toEqual({
      provenance: "uncertain",
      geometry: null,
    });
    expect(saved.constructability.routePolicyVersion).toBe(1);
  });

  it("carries the locked depth through Site answers, public submission and saved report", async () => {
    const original = snapshotService.verify(validSubmission.assessmentSnapshot);
    const locked = snapshotService.refresh(
      { ...original, lockedEstimatedDepthMetres: 1.9 },
      { detailedChecks: completeDetailedChecks() },
    );
    const response = await handleSiteAnswersRequest(
      new Request(
        "http://localhost/api/public/assessment-snapshot/site-answers",
        {
          method: "POST",
          body: JSON.stringify({
            assessmentSnapshot: locked,
            accessConditions: ["none_of_these"],
            nearbyFeatures: ["none_of_these"],
          }),
        },
      ),
    );
    expect(response.status).toBe(200);
    const signed = await response.json();
    const request = parseBrowserAssessmentSaveRequest({
      ...validSubmission,
      assessmentSnapshot: signed.assessmentSnapshot,
      constructability: signed.answers,
      poolLayout: {
        ...validSubmission.poolLayout,
        lengthMetres: 6,
        widthMetres: 3,
      },
    });
    const snapshot = snapshotService.verify(request.assessmentSnapshot);
    const submission = await buildServerAssessmentSubmission({
      request,
      snapshot,
    });
    const saved = buildSavedPreliminaryReport({
      submission,
      reference: "GF-2026-000099",
      createdAt: "2026-07-30T00:00:00.000Z",
    });
    expect(saved.constructability).toMatchObject({
      version: 1,
      estimatedDepthMetres: 1.9,
      excavationGeometry: {
        version: 2,
        assumptionId: "user-selected-side-clearance-v1",
        inputs: {
          lengthMetres: 6,
          widthMetres: 3,
          estimatedDepthMetres: 1.9,
        },
        poolOutlineCubicMetres: 34.2,
        sideAllowanceCubicMetres: 45.14,
        sideAllowanceMetres: 0.3,
        selectionSource: "default_300mm",
        specialistDepthWarning: true,
        terrainAdjustment: "unavailable",
      },
    });
    await expect(
      buildServerAssessmentSubmission({
        request,
        snapshot: { ...snapshot, lockedEstimatedDepthMetres: 2 },
      }),
    ).rejects.toThrow("INVALID_CONSTRUCTABILITY_ROUTE");
  });

  it("accepts a Homeowner submission with a locked detailed-check depth and no Site answers", async () => {
    const original = snapshotService.verify(validSubmission.assessmentSnapshot);
    const assessmentSnapshot = snapshotService.refresh(
      { ...original, lockedEstimatedDepthMetres: 1.5 },
      { detailedChecks: completeDetailedChecks() },
    );
    const request = parseBrowserAssessmentSaveRequest({
      ...validSubmission,
      assessmentSnapshot,
    });

    const submission = await buildServerAssessmentSubmission({
      request,
      snapshot: snapshotService.verify(request.assessmentSnapshot),
    });

    expect("constructability" in submission).toBe(false);
    expect(submission.report.reportData.reportAudience).toBe("homeowner");
  });

  it("rejects malformed Site evidence before any assessment is saved", async () => {
    const response = await POST_PUBLIC(
      new Request("https://pool.example/api/public/assessments", {
        method: "POST",
        body: JSON.stringify({
          ...validSubmission,
          constructability: {
            version: 1,
            estimatedDepthMetres: 2.1,
            route: { provenance: "uncertain", geometry: null },
            accessConditions: ["none_of_these", "rocky_ground"],
            nearbyFeatures: ["none_of_these"],
          },
        }),
      }),
    );
    expect(response.status).toBe(400);
    expect(getDb).not.toHaveBeenCalled();
    expect(saveHomeownerAssessment).not.toHaveBeenCalled();
  });

  it("rejects Site inputs changed after the trusted snapshot was issued", async () => {
    const answers = {
      version: 1 as const,
      estimatedDepthMetres: 1.5,
      route: { provenance: "uncertain" as const, geometry: null },
      accessConditions: ["none_of_these" as const],
      nearbyFeatures: ["none_of_these" as const],
    };
    const baseSnapshot = snapshotService.verify(
      validSubmission.assessmentSnapshot,
    );
    const assessmentSnapshot = issueTrustedAssessmentSnapshot(
      baseSnapshot.fastResult,
      {
        answers,
        evidence: {
          suggestedRoute: null,
          mappedEvidence: [],
          providerAvailability: [],
          assumptions: [],
        },
      },
    );
    const response = await POST_PUBLIC(
      new Request("https://pool.example/api/public/assessments", {
        method: "POST",
        body: JSON.stringify({
          ...validSubmission,
          assessmentSnapshot,
          constructability: { ...answers, estimatedDepthMetres: 1.8 },
        }),
      }),
    );
    expect(response.status).toBe(400);
    expect(getDb).not.toHaveBeenCalled();
    expect(saveHomeownerAssessment).not.toHaveBeenCalled();
  });

  it("does not let a duplicate request omit signed Site evidence", async () => {
    const answers = {
      version: 1 as const,
      estimatedDepthMetres: 1.5,
      route: { provenance: "uncertain" as const, geometry: null },
      accessConditions: ["none_of_these" as const],
      nearbyFeatures: ["none_of_these" as const],
    };
    const baseSnapshot = snapshotService.verify(
      validSubmission.assessmentSnapshot,
    );
    const assessmentSnapshot = issueTrustedAssessmentSnapshot(
      baseSnapshot.fastResult,
      {
        answers,
        evidence: {
          suggestedRoute: null,
          mappedEvidence: [],
          providerAvailability: [],
          assumptions: [],
        },
      },
    );
    const response = await POST_PUBLIC(
      new Request("https://pool.example/api/public/assessments", {
        method: "POST",
        body: JSON.stringify({ ...validSubmission, assessmentSnapshot }),
      }),
    );
    expect(response.status).toBe(400);
    expect(getDb).not.toHaveBeenCalled();
  });

  it("marks a saved report without Site evidence explicitly not assessed", async () => {
    const request = parseBrowserAssessmentSaveRequest(validSubmission);
    const submission = await buildServerAssessmentSubmission({
      request,
      snapshot: snapshotService.verify(request.assessmentSnapshot),
    });
    const saved = buildSavedPreliminaryReport({
      submission,
      reference: "GF-2026-000001",
      createdAt: "2026-07-30T00:00:00.000Z",
    });
    expect(saved.constructability).toMatchObject({
      version: 0,
      status: "not_assessed",
    });
  });

  it("keeps critical Site uncertainty neutral in the saved overall result", async () => {
    const answers = {
      version: 1 as const,
      estimatedDepthMetres: 1.5,
      route: { provenance: "uncertain" as const, geometry: null },
      accessConditions: ["not_sure" as const],
      nearbyFeatures: ["none_of_these" as const],
    };
    const baseSnapshot = snapshotService.verify(
      validSubmission.assessmentSnapshot,
    );
    const assessmentSnapshot = issueTrustedAssessmentSnapshot(
      baseSnapshot.fastResult,
      {
        answers,
        evidence: {
          suggestedRoute: null,
          mappedEvidence: [],
          providerAvailability: [],
          assumptions: [],
        },
      },
    );
    const request = parseBrowserAssessmentSaveRequest({
      ...validSubmission,
      assessmentSnapshot,
      constructability: answers,
    });
    const submission = await buildServerAssessmentSubmission({
      request,
      snapshot: snapshotService.verify(request.assessmentSnapshot),
    });
    const saved = buildSavedPreliminaryReport({
      submission,
      reference: "GF-2026-000001",
      createdAt: "2026-07-30T00:00:00.000Z",
    });
    expect(
      saved.constructability.version === 1 &&
        saved.constructability.overallStatus,
    ).toBe("not_fully_assessed");
    expect(saved.overall.status).not.toBe("green");
    expect(saved.constructability).toMatchObject({
      sectionStatus: "not_assessed",
      findings: expect.arrayContaining([
        expect.objectContaining({ status: "not_assessed" }),
      ]),
    });
  });

  it("persists per-layer placement findings from the trusted map snapshot", async () => {
    const original = snapshotService.verify(validSubmission.assessmentSnapshot);
    const detailedChecks = completeDetailedChecks();
    const stormwater = detailedChecks.layers.find(
      (layer) => layer.key === "public_stormwater_assets",
    );
    if (!stormwater) throw new Error("TEST_STORMWATER_LAYER_MISSING");
    stormwater.state = "returned";
    stormwater.geometry = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: original.fastResult.boundary.geometry!,
        },
      ],
    };
    stormwater.evidence = {
      ...stormwater.evidence,
      dataset: "Stormwater Pipes",
      status: "success",
      evidenceUse: "report_allowed",
      featureCount: 1,
    };
    const request = parseBrowserAssessmentSaveRequest({
      ...validSubmission,
      assessmentSnapshot: issueTrustedAssessmentSnapshot({
        ...original.fastResult,
        detailedChecks,
      }),
    });

    const submission = await buildServerAssessmentSubmission({
      request,
      snapshot: snapshotService.verify(request.assessmentSnapshot),
      now: () => new Date("2026-07-30T00:00:00.000Z"),
    });

    expect(submission.report.reportData.placementLayerFindings).toEqual([
      {
        key: "public_stormwater_assets",
        dataset: "Stormwater Pipes",
        category: "stormwater",
        status: "potential_constraint",
        evidence: "reliable",
      },
    ]);
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
    const assessmentSnapshot = issueTrustedAssessmentSnapshot({
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

  it("keeps spike-only terrain measurements out of the homeowner report and suitability scoring", async () => {
    const original = snapshotService.verify(validSubmission.assessmentSnapshot);
    const detailedChecks = completeDetailedChecks();
    detailedChecks.terrain = {
      status: "measured",
      averageSlopeDegrees: 4,
      upperSlopeDegrees: 7.5,
      estimatedFallMetres: 1.35,
      downhillBearingDegrees: 135,
      downhillDirection: "South-east",
      confidence: "indicative",
      slopeSamples: [
        [174.759999, -36.850001],
        [174.760001, -36.850001],
        [174.759999, -36.849999],
        [174.760001, -36.849999],
      ].map((position, index) => ({
        position: position as [number, number],
        slopeDegrees: 3 + index,
        eastGradient: 0.04,
        northGradient: -0.03,
      })),
      source: {
        provider: "Land Information New Zealand",
        dataset: "Auckland LiDAR 1m DEM 2024",
        datasetIdentifier: "auckland-lidar-1m-dem-2024",
        status: "success",
        licenceStatus: "permitted",
        evidenceUse: "spike_only",
        retrievedAt: "2026-07-29T01:00:00.000Z",
        datasetDate: "2024",
        licence: "Creative Commons Attribution 4.0 International",
        attribution: {
          text: "Land Information New Zealand (LINZ), CC BY 4.0",
          url: "https://www.linz.govt.nz/products-services/data/licensing-and-using-data",
        },
        geometryUsed: "saved parcel elevation window",
        attributesUsed: ["elevation"],
        evidenceType: "raster_dem",
        confidence: "limited",
      },
    };
    const constructabilityAnswers = {
      version: 1 as const,
      estimatedDepthMetres: 1.5,
      route: { provenance: "uncertain" as const, geometry: null },
      accessConditions: ["none_of_these" as const],
      nearbyFeatures: ["none_of_these" as const],
    };
    const assessmentSnapshot = issueTrustedAssessmentSnapshot(
      { ...original.fastResult, detailedChecks },
      {
        answers: constructabilityAnswers,
        evidence: {
          suggestedRoute: null,
          mappedEvidence: [],
          providerAvailability: [],
          assumptions: [],
        },
      },
    );
    const request = parseBrowserAssessmentSaveRequest({
      ...validSubmission,
      assessmentSnapshot,
      constructability: constructabilityAnswers,
    });
    const submission = await buildServerAssessmentSubmission({
      request,
      snapshot: snapshotService.verify(request.assessmentSnapshot),
      now: () => new Date("2026-07-30T00:00:00.000Z"),
    });

    expect(submission.report.reportData.terrain).toMatchObject({
      status: "measured",
      reportEligibility: "not_approved",
      averageSlopeDegrees: 4,
      source: {
        status: "success",
        licenceStatus: "permitted",
        evidenceUse: "spike_only",
        licenceUrl: null,
        geometryUsed: "saved parcel elevation window",
        attributesUsed: ["elevation"],
        evidenceType: "raster_dem",
        confidence: "limited",
      },
      constructionEnvelopeTerrain: {
        averageSlopeDegrees: 4.5,
        sampleCount: 4,
      },
    });
    expect(
      submission.report.reportData.assessmentSnapshot?.feasibilityAssessment
        .categories,
    ).toContainEqual(
      expect.objectContaining({ id: "terrain_and_slope", status: "unknown" }),
    );
    expect(
      submission.report.reportData.constructability?.excavationGeometry
        ?.terrainAdjustment,
    ).toBe("unavailable");

    const report = buildSavedPreliminaryReport({
      submission,
      reference: "GF-2026-000020",
      createdAt: "2026-07-30T00:00:00.000Z",
    });
    const html = renderCanonicalPreliminaryReportHtml(report);

    expect(report.assessments.terrain).toMatchObject({
      status: "unknown",
      headline: "Needs checking",
    });
    expect(html).not.toContain("Property average slope");
    expect(html).not.toContain("4.0°");
    expect(html).not.toContain("Proposed pool construction area slope");
    expect(html).not.toContain("Auckland LiDAR 1m DEM 2024");
  });

  it.each([
    ["provider", { provider: "Uncontrolled elevation provider" }],
    ["dataset title", { dataset: "Auckland experimental elevation surface" }],
    [
      "dataset URL",
      { datasetIdentifier: "https://example.test/uncontrolled-elevation/" },
    ],
    ["capture date", { datasetDate: "2025-01-01/2025-12-31" }],
  ] as const)(
    "keeps terrain with an unrecognised %s out of the homeowner report",
    async (_field, sourceOverrides) => {
      terrainReportPromotion.enabled = true;
      const original = snapshotService.verify(
        validSubmission.assessmentSnapshot,
      );
      const detailedChecks = completeDetailedChecks();
      detailedChecks.terrain = reportAllowedTerrain(sourceOverrides);
      const assessmentSnapshot = issueTrustedAssessmentSnapshot({
        ...original.fastResult,
        detailedChecks,
      });
      const request = parseBrowserAssessmentSaveRequest({
        ...validSubmission,
        assessmentSnapshot,
      });

      const submission = await buildServerAssessmentSubmission({
        request,
        snapshot: snapshotService.verify(request.assessmentSnapshot),
        now: () => new Date("2026-07-30T00:00:00.000Z"),
      });
      const report = buildSavedPreliminaryReport({
        submission,
        reference: "GF-2026-000021",
        createdAt: "2026-07-30T00:00:00.000Z",
      });
      const html = renderCanonicalPreliminaryReportHtml(report);

      expect(submission.report.reportData.terrain).toMatchObject({
        status: "measured",
        reportEligibility: "not_approved",
      });
      expect(report.assessments.terrain).toMatchObject({
        status: "unknown",
        headline: "Needs checking",
      });
      expect(html).not.toContain("Property average slope");
    },
  );

  it("approves a catalogue-pinned contributing asset when the promotion gate is enabled", async () => {
    terrainReportPromotion.enabled = true;
    const original = snapshotService.verify(validSubmission.assessmentSnapshot);
    const detailedChecks = completeDetailedChecks();
    const terrain = reportAllowedTerrain();
    const asset = terrain.source.contributingAssets?.[0];
    if (!asset) throw new Error("TEST_TERRAIN_ASSET_MISSING");
    Object.assign(asset, { datasetDate: "2024-06-26/2024-11-04" });
    detailedChecks.terrain = terrain;
    const constructabilityAnswers = {
      version: 1 as const,
      estimatedDepthMetres: 1.5,
      route: { provenance: "uncertain" as const, geometry: null },
      accessConditions: ["none_of_these" as const],
      nearbyFeatures: ["none_of_these" as const],
    };
    const assessmentSnapshot = issueTrustedAssessmentSnapshot(
      { ...original.fastResult, detailedChecks },
      {
        answers: constructabilityAnswers,
        evidence: {
          suggestedRoute: null,
          mappedEvidence: [],
          providerAvailability: [],
          assumptions: [],
        },
      },
    );
    const request = parseBrowserAssessmentSaveRequest({
      ...validSubmission,
      assessmentSnapshot,
      constructability: constructabilityAnswers,
    });

    const submission = await buildServerAssessmentSubmission({
      request,
      snapshot: snapshotService.verify(request.assessmentSnapshot),
      now: () => new Date("2026-07-30T00:00:00.000Z"),
    });

    expect(submission.report.reportData.terrain).toMatchObject({
      status: "measured",
      reportEligibility: "approved",
      source: {
        contributingAssets: [
          {
            dataset: "Auckland Part 2 LiDAR 1m DEM (2024)",
            datasetIdentifier:
              "https://data.linz.govt.nz/layer/122580-auckland-part-2-lidar-1m-dem-2024/",
            datasetDate: "2024-06-26/2024-11-04",
          },
        ],
      },
    });
    expect(
      submission.report.reportData.constructability?.excavationGeometry
        ?.terrainAdjustment,
    ).toBe("available_separate");
  });

  it("presents the approved headline slope values as buffered proposed-pool measurements", async () => {
    terrainReportPromotion.enabled = true;
    const snapshot = snapshotService.verify(validSubmission.assessmentSnapshot);
    const request = parseBrowserAssessmentSaveRequest(validSubmission);
    const submission = await buildServerAssessmentSubmission({
      request,
      snapshot,
      terrainGateway: {
        assessParcel: async () => ({
          ...reportAllowedTerrain(),
          averageSlopeDegrees: 16.7,
          upperSlopeDegrees: 19,
          estimatedFallMetres: 1.8,
          downhillBearingDegrees: 270,
          downhillDirection: "W",
        }),
      },
      now: () => new Date("2026-07-30T00:00:00.000Z"),
    });
    const report = buildSavedPreliminaryReport({
      submission,
      reference: "GF-2026-000021",
      createdAt: "2026-07-30T00:00:00.000Z",
    });

    expect(report.assessments.terrain.details).toEqual([
      { label: "Proposed pool area average slope", value: "16.7°" },
      { label: "Steeper sampled pool areas", value: "19.0°" },
      { label: "Estimated pool area height change", value: "1.80 m" },
      { label: "Pool area downhill direction", value: "W" },
    ]);
    expect(submission.report.reportData.terrain).toMatchObject({
      analysisArea: "buffered_proposed_pool",
      constructionEnvelopeTerrain: null,
      source: {
        derivedProductNotice:
          "Elevation data was clipped to the buffered proposed-pool area and used to derive indicative slope measurements.",
      },
    });
    expect(report.terrain).toMatchObject({
      analysisArea: "buffered_proposed_pool",
      source: {
        derivedProductNotice:
          "Elevation data was clipped to the buffered proposed-pool area and used to derive indicative slope measurements.",
      },
    });
    const html = renderCanonicalPreliminaryReportHtml(report);
    expect(html).toContain("Proposed pool area average slope");
    expect(html).toContain("16.7°");
    expect(html).not.toContain("Property average slope");
  });

  it("rejects a contributing asset URL that is not in the controlled catalogue", async () => {
    terrainReportPromotion.enabled = true;
    const original = snapshotService.verify(validSubmission.assessmentSnapshot);
    const detailedChecks = completeDetailedChecks();
    const terrain = reportAllowedTerrain();
    const asset = terrain.source.contributingAssets?.[0];
    if (!asset) throw new Error("TEST_TERRAIN_ASSET_MISSING");
    terrain.source.contributingAssets = [
      { ...asset, assetUrl: "https://example.test/uncontrolled-terrain.tiff" },
    ];
    detailedChecks.terrain = terrain;
    const assessmentSnapshot = issueTrustedAssessmentSnapshot({
      ...original.fastResult,
      detailedChecks,
    });
    const request = parseBrowserAssessmentSaveRequest({
      ...validSubmission,
      assessmentSnapshot,
    });

    const submission = await buildServerAssessmentSubmission({
      request,
      snapshot: snapshotService.verify(request.assessmentSnapshot),
      now: () => new Date("2026-07-30T00:00:00.000Z"),
    });

    expect(submission.report.reportData.terrain).toMatchObject({
      status: "measured",
      reportEligibility: "not_approved",
    });
  });

  it("rejects a contributing STAC item URL that is not in the controlled catalogue", async () => {
    terrainReportPromotion.enabled = true;
    const original = snapshotService.verify(validSubmission.assessmentSnapshot);
    const detailedChecks = completeDetailedChecks();
    const terrain = reportAllowedTerrain();
    const asset = terrain.source.contributingAssets?.[0];
    if (!asset) throw new Error("TEST_TERRAIN_ASSET_MISSING");
    terrain.source.contributingAssets = [
      {
        ...asset,
        stacItemUrl: "https://example.test/uncontrolled-terrain.json",
      },
    ];
    detailedChecks.terrain = terrain;
    const assessmentSnapshot = issueTrustedAssessmentSnapshot({
      ...original.fastResult,
      detailedChecks,
    });
    const request = parseBrowserAssessmentSaveRequest({
      ...validSubmission,
      assessmentSnapshot,
    });

    const submission = await buildServerAssessmentSubmission({
      request,
      snapshot: snapshotService.verify(request.assessmentSnapshot),
      now: () => new Date("2026-07-30T00:00:00.000Z"),
    });

    expect(submission.report.reportData.terrain).toMatchObject({
      status: "measured",
      reportEligibility: "not_approved",
    });
  });

  it("rejects a contributing asset checksum that does not match the controlled catalogue", async () => {
    terrainReportPromotion.enabled = true;
    const original = snapshotService.verify(validSubmission.assessmentSnapshot);
    const detailedChecks = completeDetailedChecks();
    const terrain = reportAllowedTerrain();
    const asset = terrain.source.contributingAssets?.[0];
    if (!asset) throw new Error("TEST_TERRAIN_ASSET_MISSING");
    terrain.source.contributingAssets = [
      {
        ...asset,
        assetChecksum:
          "1220ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      },
    ];
    detailedChecks.terrain = terrain;
    const assessmentSnapshot = issueTrustedAssessmentSnapshot({
      ...original.fastResult,
      detailedChecks,
    });
    const request = parseBrowserAssessmentSaveRequest({
      ...validSubmission,
      assessmentSnapshot,
    });

    const submission = await buildServerAssessmentSubmission({
      request,
      snapshot: snapshotService.verify(request.assessmentSnapshot),
      now: () => new Date("2026-07-30T00:00:00.000Z"),
    });

    expect(submission.report.reportData.terrain).toMatchObject({
      status: "measured",
      reportEligibility: "not_approved",
    });
  });

  it("rejects contributing asset metadata from a different catalogue version", async () => {
    terrainReportPromotion.enabled = true;
    const original = snapshotService.verify(validSubmission.assessmentSnapshot);
    const detailedChecks = completeDetailedChecks();
    const terrain = reportAllowedTerrain();
    const asset = terrain.source.contributingAssets?.[0];
    if (!asset) throw new Error("TEST_TERRAIN_ASSET_MISSING");
    terrain.source.contributingAssets = [
      { ...asset, assetUpdatedAt: "2025-01-01T00:00:00.000Z" },
    ];
    detailedChecks.terrain = terrain;
    const assessmentSnapshot = issueTrustedAssessmentSnapshot({
      ...original.fastResult,
      detailedChecks,
    });
    const request = parseBrowserAssessmentSaveRequest({
      ...validSubmission,
      assessmentSnapshot,
    });

    const submission = await buildServerAssessmentSubmission({
      request,
      snapshot: snapshotService.verify(request.assessmentSnapshot),
      now: () => new Date("2026-07-30T00:00:00.000Z"),
    });

    expect(submission.report.reportData.terrain).toMatchObject({
      status: "measured",
      reportEligibility: "not_approved",
    });
  });

  it("keeps controlled terrain out of the homeowner report until promotion is approved", async () => {
    const original = snapshotService.verify(validSubmission.assessmentSnapshot);
    const detailedChecks = completeDetailedChecks();
    detailedChecks.terrain = {
      status: "measured",
      averageSlopeDegrees: 4,
      upperSlopeDegrees: 7.5,
      estimatedFallMetres: 1.35,
      downhillBearingDegrees: 135,
      downhillDirection: "South-east",
      confidence: "indicative",
      slopeSamples: [
        [174.759999, -36.850001],
        [174.760001, -36.850001],
        [174.759999, -36.849999],
        [174.760001, -36.849999],
      ].map((position, index) => ({
        position: position as [number, number],
        slopeDegrees: 3 + index,
        eastGradient: 0.04,
        northGradient: -0.03,
      })),
      source: {
        provider: "Land Information New Zealand",
        dataset: "Auckland Part 1 LiDAR 1m DEM (2024)",
        datasetIdentifier:
          "https://data.linz.govt.nz/layer/121990-auckland-part-1-lidar-1m-dem-2024/",
        status: "success",
        licenceStatus: "permitted",
        evidenceUse: "report_allowed",
        retrievedAt: "2026-07-29T01:00:00.000Z",
        datasetDate: "2024-04-30/2024-06-27",
        ...AUCKLAND_DEM_REQUIRED_METADATA,
        geometryUsed: "saved parcel elevation window",
        attributesUsed: ["elevation"],
        evidenceType: "raster_dem",
        confidence: "limited",
        contributingAssets: [
          {
            provider: "Land Information New Zealand",
            dataset: "Auckland Part 1 LiDAR 1m DEM (2024)",
            datasetIdentifier:
              "https://data.linz.govt.nz/layer/121990-auckland-part-1-lidar-1m-dem-2024/",
            stacCollectionUrl:
              "https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-1_2024/dem_1m/2193/collection.json",
            assetUrl: "https://example.test/BA31_10000_0403.tiff",
            stacItemUrl: "https://example.test/BA31_10000_0403.json",
            assetChecksum: "sha256:terrain-test-checksum",
            assetUpdatedAt: "2026-03-27T00:00:00.000Z",
            retrievedAt: "2026-07-29T01:00:00.000Z",
            boundsNztm: {
              minimumEast: 1,
              minimumNorth: 2,
              maximumEast: 3,
              maximumNorth: 4,
            },
          },
        ],
      },
    };
    const assessmentSnapshot = issueTrustedAssessmentSnapshot({
      ...original.fastResult,
      detailedChecks,
    });
    const request = parseBrowserAssessmentSaveRequest({
      ...validSubmission,
      assessmentSnapshot,
    });
    const submission = await buildServerAssessmentSubmission({
      request,
      snapshot: snapshotService.verify(request.assessmentSnapshot),
      now: () => new Date("2026-07-30T00:00:00.000Z"),
    });

    expect(submission.report.reportData.terrain).toMatchObject({
      status: "measured",
      reportEligibility: "not_approved",
      source: {
        datasetDate: "2024-04-30/2024-06-27",
        licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
        attribution: AUCKLAND_DEM_REQUIRED_METADATA.attribution,
        derivedProductNotice:
          "Elevation data was clipped to the assessed property and used to derive indicative slope measurements.",
        contributingAssets: [
          {
            stacItemUrl: "https://example.test/BA31_10000_0403.json",
            assetChecksum: "sha256:terrain-test-checksum",
          },
        ],
      },
    });

    const report = buildSavedPreliminaryReport({
      submission,
      reference: "GF-2026-000021",
      createdAt: "2026-07-30T00:00:00.000Z",
    });
    const html = renderCanonicalPreliminaryReportHtml(report);

    expect(report.assessments.terrain).toMatchObject({
      status: "unknown",
      headline: "Needs checking",
    });
    expect(html).not.toContain("Property average slope");
    expect(html).not.toContain("4.0°");
    expect(html).not.toContain(AUCKLAND_DEM_REQUIRED_METADATA.attribution.text);
    expect(html).not.toContain("Checksum sha256:terrain-test-checksum");
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
    const assessmentSnapshot = issueTrustedAssessmentSnapshot({
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
    const assessmentSnapshot = issueTrustedAssessmentSnapshot({
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
    issueSavedReportAccessToken.mockReturnValue("saved-report-access-token");

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
  });

  it("returns an existing report without preparing detailed mapping again", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("INTERNAL_REPORT_SIGNING_SECRET", snapshotSigningKey);
    const existingAssessment = {
      id: ASSESSMENT_ID,
      reference: "GF-2026-000001",
      status: "new_enquiry",
      emailDeliveryState: "pending",
      forwardingState: "pending",
    };
    getHomeownerAssessmentByIdempotencyKey
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingAssessment);
    saveHomeownerAssessment
      .mockResolvedValueOnce({ assessment: existingAssessment, created: true })
      .mockResolvedValueOnce({
        assessment: existingAssessment,
        created: false,
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
      pool: { lengthMetres: 6.5, widthMetres: 3, rotationDegrees: 12 },
      warnings: [],
      recommendations: [],
      layers: [],
      limitations: [],
      mapImageDataUrl: TEST_MAP_IMAGE_DATA_URL,
    });
    issueSavedReportAccessToken.mockReturnValue("saved-report-access-token");

    const createRequest = () =>
      new Request("http://127.0.0.1:3000/api/internal/assessments", {
        method: "POST",
        body: JSON.stringify(validSubmission),
      });

    expect((await POST(createRequest())).status).toBe(201);
    expect((await POST(createRequest())).status).toBe(200);

    expect(executeFastPropertyDetailsRequest).toHaveBeenCalledOnce();
    expect(saveHomeownerAssessment).toHaveBeenCalledOnce();
  });

  it("returns an already-saved assessment", async () => {
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
    getSavedPreliminaryReportById.mockResolvedValue({} as never);
    issueSavedReportAccessToken.mockReturnValue("saved-report-access-token");

    const response = await POST(
      new Request("http://127.0.0.1:3000/api/internal/assessments", {
        method: "POST",
        body: JSON.stringify(validSubmission),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      assessment: {
        id: "assessment-1",
        reference: "GF-2026-000001",
        created: false,
        reportAccessToken: "saved-report-access-token",
      },
    });
    expect(getSavedPreliminaryReportById).toHaveBeenCalledWith(
      expect.anything(),
      "assessment-1",
    );
  });

  it("returns a retryable response when saved-report access is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INTERNAL_REPORT_SIGNING_SECRET", "");
    saveHomeownerAssessment.mockResolvedValue({
      assessment: {
        id: ASSESSMENT_ID,
        reference: "GF-2026-000001",
        status: "new_enquiry",
        emailDeliveryState: "pending",
        forwardingState: "pending",
      },
      created: true,
    });
    getSavedPreliminaryReportById.mockResolvedValue({} as never);
    issueSavedReportAccessToken.mockImplementation(() => {
      throw new Error("INTERNAL_REPORT_SIGNING_SECRET_REQUIRED");
    });

    const response = await POST_PUBLIC(
      new Request("https://pool.example/api/public/assessments", {
        method: "POST",
        headers: { "x-correlation-id": "report-access-unavailable" },
        body: JSON.stringify(validSubmission),
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "REPORT_ACCESS_UNAVAILABLE",
        message:
          "The saved report is temporarily unavailable. Please try again shortly.",
        correlationId: "report-access-unavailable",
      },
    });
  });

  it("returns a safe correlated response when assessment storage is unavailable", async () => {
    getDb.mockImplementationOnce(() => {
      throw new Error("DATABASE_URL is required for persisted assessments.");
    });

    const response = await POST_PUBLIC(
      new Request("https://pool.example/api/public/assessments", {
        method: "POST",
        headers: { "x-correlation-id": "assessment-storage-unavailable" },
        body: JSON.stringify(validSubmission),
      }),
    );

    expect(response.status).toBe(500);
    expect(response.headers.get("x-correlation-id")).toBe(
      "assessment-storage-unavailable",
    );
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "ASSESSMENT_SAVE_FAILED",
        message: "The assessment could not be saved. Please try again shortly.",
        correlationId: "assessment-storage-unavailable",
      },
    });
  });
});

function completeDetailedChecks(): FastPropertyDetails {
  const retrievedAt = "2026-07-29T01:00:00.000Z";
  return {
    status: "complete" as const,
    constraints: {
      status: "complete",
      retryableLayerKeys: [],
      unavailableLayerKeys: [],
    },
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

function reportAllowedTerrain(
  sourceOverrides: Partial<
    Extract<
      NonNullable<FastPropertyDetails["terrain"]>,
      { status: "measured" }
    >["source"]
  > = {},
): Extract<
  NonNullable<FastPropertyDetails["terrain"]>,
  { status: "measured" }
> {
  const dataset = "Auckland Part 2 LiDAR 1m DEM (2024)";
  const datasetIdentifier =
    "https://data.linz.govt.nz/layer/122580-auckland-part-2-lidar-1m-dem-2024/";
  return {
    status: "measured",
    averageSlopeDegrees: 4,
    upperSlopeDegrees: 7.5,
    estimatedFallMetres: 1.35,
    downhillBearingDegrees: 135,
    downhillDirection: "South-east",
    confidence: "indicative",
    source: {
      provider: "Land Information New Zealand",
      dataset,
      datasetIdentifier,
      status: "success",
      licenceStatus: "permitted",
      evidenceUse: "report_allowed",
      retrievedAt: "2026-07-29T01:00:00.000Z",
      datasetDate: "2024-06-26/2024-11-04",
      ...AUCKLAND_DEM_REQUIRED_METADATA,
      geometryUsed: "saved parcel elevation window",
      attributesUsed: ["elevation"],
      evidenceType: "raster_dem",
      confidence: "limited",
      contributingAssets: [
        {
          provider: "Land Information New Zealand",
          dataset,
          datasetIdentifier,
          stacCollectionUrl:
            "https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-2_2024/dem_1m/2193/collection.json",
          assetUrl:
            "https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-2_2024/dem_1m/2193/AY30_10000_0504.tiff",
          stacItemUrl:
            "https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-2_2024/dem_1m/2193/AY30_10000_0504.json",
          assetChecksum:
            "12201aa48baf55dbf6b467ccc5ccddf022095bd616fff151e14c33d72bf7a9c81485",
          assetUpdatedAt: "2026-01-13T21:29:07Z",
          retrievedAt: "2026-07-29T01:00:00.000Z",
          boundsNztm: {
            minimumEast: 1,
            minimumNorth: 2,
            maximumEast: 3,
            maximumNorth: 4,
          },
        },
      ],
      ...sourceOverrides,
    },
  };
}
