import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  issueAssessmentSnapshot,
  refreshAssessmentSnapshot,
  verifyAssessmentSnapshot,
} from "@/modules/assessment/assessment-snapshot";
import { handleSiteAnswersRequest } from "@/modules/assessment/handle-site-answers-request";
import type { FastPropertyViewResult } from "@/modules/data-access-spike/fast-property-view";

const fastResult = {
  resolvedAddress: {
    addressId: "linz-site-1",
    fullAddress: "1 Test Street, Auckland",
    coordinates: [174.76, -36.85],
  },
  boundary: { state: "confirmed" },
} as FastPropertyViewResult;

const answers = {
  accessConditions: ["gate_or_narrow_passage", "rocky_ground"],
  nearbyFeatures: ["fences", "doors_or_windows"],
};

function request(body: unknown) {
  return new Request(
    "http://localhost/api/public/assessment-snapshot/site-answers",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

describe("public Site answers boundary", () => {
  it("uses the locked depth in signed Site answers and the constructability snapshot", async () => {
    const initial = verifyAssessmentSnapshot(
      issueAssessmentSnapshot(fastResult),
    );
    const locked = refreshAssessmentSnapshot(
      { ...initial, lockedEstimatedDepthMetres: 1.9 },
      { detailedChecks: { status: "complete" } as never },
    );
    const response = await handleSiteAnswersRequest(
      request({
        assessmentSnapshot: locked,
        ...answers,
        sideClearanceMillimetres: 200,
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.answers.estimatedDepthMetres).toBe(1.9);
    expect(body.answers.excavationSideAllowanceMetres).toBe(0.2);
    expect(
      verifyAssessmentSnapshot(body.assessmentSnapshot).constructability
        ?.answers,
    ).toMatchObject({
      estimatedDepthMetres: 1.9,
      excavationSideAllowanceMetres: 0.2,
    });
  });

  it("rejects a pool position that the final assessment cannot save", async () => {
    const response = await handleSiteAnswersRequest(
      request({
        assessmentSnapshot: issueAssessmentSnapshot(fastResult),
        ...answers,
        routeResponse: "not_sure",
        poolLayout: {
          position: [0, 0],
          lengthMetres: 4,
          widthMetres: 2.4,
          rotationDegrees: 0,
        },
      }),
    );

    expect(response.status).toBe(400);
  });

  it("signs the deterministic suggestion and the homeowner's confirmation for the selected pool", async () => {
    const property = {
      ...fastResult,
      boundary: {
        state: "confirmed",
        geometry: {
          type: "Polygon",
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
      resolvedAddress: {
        ...fastResult.resolvedAddress,
        coordinates: [174.76015, -36.850005],
      },
      detailedChecks: {
        layers: [
          {
            key: "building_footprints",
            state: "verified_empty",
            geometry: null,
          },
        ],
        terrain: {
          status: "measured",
          upperSlopeDegrees: 2,
          source: { evidenceUse: "report_allowed" },
        },
      },
    } as FastPropertyViewResult;
    const poolLayout = {
      layoutId: "plunge" as const,
      layoutName: "Plunge" as const,
      position: [174.76015, -36.8499],
      lengthMetres: 4,
      widthMetres: 2.4,
      rotationDegrees: 0,
    };
    const suggestedResponse = await handleSiteAnswersRequest(
      request({
        assessmentSnapshot: issueAssessmentSnapshot(property),
        ...answers,
        routeResponse: "suggested",
        poolLayout,
      }),
    );
    expect(suggestedResponse.status).toBe(200);
    const suggested = verifyAssessmentSnapshot(
      (await suggestedResponse.json()).assessmentSnapshot,
    );
    expect(suggested.constructability?.answers.route).toMatchObject({
      provenance: "suggested",
      geometry: { type: "LineString" },
    });

    const response = await handleSiteAnswersRequest(
      request({
        assessmentSnapshot: issueAssessmentSnapshot(property),
        ...answers,
        routeResponse: "confirm",
        poolLayout,
      }),
    );
    expect(response.status).toBe(200);
    const signed = verifyAssessmentSnapshot(
      (await response.json()).assessmentSnapshot,
    );
    expect(signed.constructability?.answers.route).toMatchObject({
      provenance: "confirmed",
      geometry: { type: "LineString" },
    });
    expect(signed.constructability?.evidence.suggestedRoute).toEqual(
      signed.constructability?.answers.route.geometry,
    );
    expect(signed.constructability?.evidence.routePolicyVersion).toBe(1);
    const suggestion = signed.constructability!.evidence.suggestedRoute!;
    const [start, end] = suggestion.coordinates;
    const adjustedRoute = {
      type: "LineString",
      coordinates: [
        start,
        [(start![0] + end![0]) / 2 + 0.00001, (start![1] + end![1]) / 2],
        end,
      ],
    };
    const adjusted = await handleSiteAnswersRequest(
      request({
        assessmentSnapshot: issueAssessmentSnapshot(property),
        ...answers,
        routeResponse: "adjust",
        poolLayout,
        adjustedRoute,
      }),
    );
    expect(adjusted.status).toBe(200);
    const saved = verifyAssessmentSnapshot(
      (await adjusted.json()).assessmentSnapshot,
    );
    expect(saved.constructability?.answers.route).toEqual({
      provenance: "user-supplied",
      geometry: adjustedRoute,
    });
    expect(saved.constructability?.evidence.routeFacts).toMatchObject({
      valid: true,
      length: { status: "assessed" },
      services: { status: "not_assessed", reason: "data_unavailable" },
    });
    const changedEndpoint = await handleSiteAnswersRequest(
      request({
        assessmentSnapshot: issueAssessmentSnapshot(property),
        ...answers,
        routeResponse: "adjust",
        poolLayout,
        adjustedRoute: {
          ...adjustedRoute,
          coordinates: [[174.76, -36.85], adjustedRoute.coordinates[1], end],
        },
      }),
    );
    expect(changedEndpoint.status).toBe(400);
    const invalidGeometry = await handleSiteAnswersRequest(
      request({
        assessmentSnapshot: issueAssessmentSnapshot(property),
        ...answers,
        routeResponse: "adjust",
        poolLayout,
        adjustedRoute: { type: "LineString", coordinates: [start, start, end] },
      }),
    );
    expect(invalidGeometry.status).toBe(200);
    const invalidSaved = verifyAssessmentSnapshot(
      (await invalidGeometry.json()).assessmentSnapshot,
    );
    expect(invalidSaved.constructability?.evidence.routeFacts).toMatchObject({
      valid: false,
      length: { status: "not_assessed", reason: "invalid_geometry" },
    });
  });

  it("keeps the Site journey completable with uncertain provenance when route evidence is unavailable", async () => {
    const poolLayout = {
      layoutId: "plunge" as const,
      layoutName: "Plunge" as const,
      position: [174.76015, -36.8499],
      lengthMetres: 4,
      widthMetres: 2.4,
      rotationDegrees: 0,
    };
    const token = issueAssessmentSnapshot(fastResult);
    const response = await handleSiteAnswersRequest(
      request({
        assessmentSnapshot: token,
        ...answers,
        routeResponse: "not_sure",
        poolLayout,
      }),
    );
    expect(response.status).toBe(200);
    const signed = verifyAssessmentSnapshot(
      (await response.json()).assessmentSnapshot,
    );
    expect(signed.constructability?.answers.route).toEqual({
      provenance: "uncertain",
      geometry: null,
    });
    expect(signed.constructability?.evidence).toMatchObject({
      suggestedRoute: null,
      routePolicyVersion: 1,
    });
    const invalidConfirmation = await handleSiteAnswersRequest(
      request({
        assessmentSnapshot: token,
        ...answers,
        routeResponse: "confirm",
        poolLayout,
      }),
    );
    expect(invalidConfirmation.status).toBe(400);
  });
  it("signs fixed user answers while preserving the original submission identity", async () => {
    const token = issueAssessmentSnapshot(fastResult);
    const original = verifyAssessmentSnapshot(token);
    const response = await handleSiteAnswersRequest(
      request({ assessmentSnapshot: token, ...answers }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    const signed = verifyAssessmentSnapshot(body.assessmentSnapshot);
    expect(signed.submissionId).toBe(original.submissionId);
    expect(signed.constructability?.answers).toMatchObject({
      version: 1,
      estimatedDepthMetres: 1.5,
      route: { provenance: "uncertain", geometry: null },
      ...answers,
    });
    expect(signed.constructability?.evidence.mappedEvidence).toEqual([]);
  });

  it("rejects exclusive answers mixed with conditions and invalid tokens", async () => {
    const token = issueAssessmentSnapshot(fastResult);
    const mixed = await handleSiteAnswersRequest(
      request({
        assessmentSnapshot: token,
        accessConditions: ["none_of_these", "rocky_ground"],
        nearbyFeatures: ["none_of_these"],
      }),
    );
    expect(mixed.status).toBe(400);
    const invalid = await handleSiteAnswersRequest(
      request({ assessmentSnapshot: "invalid", ...answers }),
    );
    expect(invalid.status).toBe(400);
  });

  it("retains trusted mapped evidence when the user selects None of these", async () => {
    const token = issueAssessmentSnapshot(fastResult, {
      answers: {
        version: 1,
        estimatedDepthMetres: 1.5,
        route: { provenance: "uncertain", geometry: null },
        accessConditions: ["not_sure"],
        nearbyFeatures: ["not_sure"],
      },
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
        providerAvailability: [],
        assumptions: [],
      },
    });
    const response = await handleSiteAnswersRequest(
      request({
        assessmentSnapshot: token,
        accessConditions: ["none_of_these"],
        nearbyFeatures: ["none_of_these"],
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    const signed = verifyAssessmentSnapshot(body.assessmentSnapshot);
    expect(signed.constructability?.evidence.mappedEvidence).toEqual([
      {
        id: "mapped-retaining-wall",
        category: "access_excavation",
        status: "concern",
        provider: "official-map",
        dataset: "retaining-walls",
      },
    ]);
  });
});
