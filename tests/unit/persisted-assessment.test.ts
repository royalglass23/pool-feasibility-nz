import { describe, expect, it } from "vitest";
import { saveHomeownerAssessment } from "@/db/repositories/homeowner-assessment-repository";
import { parsePersistedAssessmentSubmission } from "@/modules/assessment/persisted-assessment";
import { TEST_MAP_IMAGE_DATA_URL } from "../fixtures/preliminary-report";

const validSubmission = {
  idempotencyKey: "submission-1234567890",
  homeowner: {
    name: "Jane Homeowner",
    phone: "021 555 1234",
    email: "jane@example.com",
    address: "1 Test Street, Auckland",
    visitorType: "homeowner",
    desiredTiming: "3_months",
    consentGiven: true,
    consentVersion: "assessment-v1",
    consentedAt: "2026-07-29T01:00:00.000Z",
  },
  addressEvidence: {
    selectedAddressId: "linz-123",
    formattedAddress: "1 Test Street, Auckland",
    latitude: -36.85,
    longitude: 174.76,
    boundaryStatus: "provisional",
  },
  poolLayout: {
    lengthMetres: 6.5,
    widthMetres: 3,
    rotationDegrees: 12,
    position: [174.76, -36.85],
    shellGeometry: { type: "Polygon", coordinates: [] },
    constructionEnvelopeGeometry: { type: "Polygon", coordinates: [] },
  },
  layerStates: [
    {
      provider: "LINZ",
      dataset: "wastewater",
      status: "returned",
      confidence: "high",
      featureCount: 1,
    },
  ],
  warnings: [
    {
      state: "needs_checking",
      code: "PROVISIONAL_BOUNDARY",
      title: "Mapped boundary needs checking",
      message: "Confirm the boundary before design.",
    },
  ],
  recommendations: [
    {
      phase: "before_concept_design",
      priority: 1,
      title: "Confirm the boundary",
      reason: "The mapped boundary is provisional.",
    },
  ],
  report: {
    analysisVersion: "mt-248-v1",
    title: "Preliminary pool feasibility assessment",
    summary: "A preliminary assessment.",
    feasibilityState: "needs_checking",
    mapImageDataUrl: TEST_MAP_IMAGE_DATA_URL,
    reportData: {
      recommendation: "Confirm the boundary.",
      preliminaryFeasibilityWording: "Preliminary only.",
      risks: [],
      actions: [],
      missingInformation: [],
      limitations: [],
      provenance: { datasets: [] },
    },
  },
};

describe("persisted homeowner assessment contract", () => {
  it("requires the complete contact and consent contract while keeping additional info optional", () => {
    const parsed = parsePersistedAssessmentSubmission(validSubmission);
    expect(parsed.homeowner.additionalInfo).toBeUndefined();
    expect(parsed.homeowner.consentGiven).toBe(true);
  });

  it("persists the selected pool-shell clearance visibility and defaults older saved layouts to visible", () => {
    expect(
      parsePersistedAssessmentSubmission({
        ...validSubmission,
        poolLayout: { ...validSubmission.poolLayout, clearancesVisible: false },
      }).poolLayout.clearancesVisible,
    ).toBe(false);
    expect(
      parsePersistedAssessmentSubmission(validSubmission).poolLayout
        .clearancesVisible,
    ).toBe(true);
  });

  it("rejects missing consent and invalid timing", () => {
    expect(() =>
      parsePersistedAssessmentSubmission({
        ...validSubmission,
        homeowner: { ...validSubmission.homeowner, consentGiven: false },
      }),
    ).toThrow();
    expect(() =>
      parsePersistedAssessmentSubmission({
        ...validSubmission,
        homeowner: { ...validSubmission.homeowner, desiredTiming: "tomorrow" },
      }),
    ).toThrow();
  });

  it("requires a brief explanation when Other is selected", () => {
    expect(() =>
      parsePersistedAssessmentSubmission({
        ...validSubmission,
        homeowner: {
          ...validSubmission.homeowner,
          visitorType: "other",
          desiredTiming: "other",
        },
      }),
    ).toThrow(/tell us who you are/i);

    expect(
      parsePersistedAssessmentSubmission({
        ...validSubmission,
        homeowner: {
          ...validSubmission.homeowner,
          visitorType: "other",
          visitorTypeOtherDetail: "Landscape architect",
          desiredTiming: "other",
          desiredTimingOtherDetail: "Next summer",
        },
      }).homeowner,
    ).toMatchObject({
      visitorType: "other",
      visitorTypeOtherDetail: "Landscape architect",
      desiredTiming: "other",
      desiredTimingOtherDetail: "Next summer",
    });
  });

  it("accepts only normalized evidence references rather than arbitrary provider payloads", () => {
    const parsed = parsePersistedAssessmentSubmission(validSubmission);
    expect(parsed.layerStates[0]).toMatchObject({
      provider: "LINZ",
      dataset: "wastewater",
      status: "returned",
    });
    expect(parsed.layerStates[0]).not.toHaveProperty("rawPayload");
  });

  it("rejects unvalidated geometry payloads", () => {
    expect(() =>
      parsePersistedAssessmentSubmission({
        ...validSubmission,
        poolLayout: {
          ...validSubmission.poolLayout,
          shellGeometry: {
            type: "Polygon",
            coordinates: { rawProviderPayload: true },
          },
        },
      }),
    ).toThrow();
  });

  it("rejects a report map that is not valid bounded PNG data", () => {
    expect(() =>
      parsePersistedAssessmentSubmission({
        ...validSubmission,
        report: {
          ...validSubmission.report,
          mapImageDataUrl: "data:image/png;base64,not-a-real-png",
        },
      }),
    ).toThrow();
  });

  it("rejects warning copy that contradicts the overall feasibility state", () => {
    expect(() =>
      parsePersistedAssessmentSubmission({
        ...validSubmission,
        report: {
          ...validSubmission.report,
          feasibilityState: "no_warning",
        },
      }),
    ).toThrow(/warning state must match/i);
  });

  it("returns one stable assessment for a duplicate submission", async () => {
    const rows: Array<Record<string, unknown>> = [];
    let sequence = 0;
    const fakeDb = {
      query: {
        homeownerAssessments: {
          findFirst: async () => rows[0],
        },
      },
      execute: async () => ({ rows: [{ value: String(++sequence) }] }),
      insert: () => {
        let values: Record<string, unknown> = {};
        return {
          values: (nextValues: Record<string, unknown>) => {
            values = nextValues;
            return {
              onConflictDoNothing: () => ({
                returning: async () => {
                  if (
                    rows.some(
                      (row) => row.idempotencyKey === values.idempotencyKey,
                    )
                  )
                    return [];
                  const row = { ...values, status: "new_enquiry" };
                  rows.push(row);
                  return [row];
                },
              }),
            };
          },
        };
      },
    } as unknown as Parameters<typeof saveHomeownerAssessment>[0];

    const first = await saveHomeownerAssessment(
      fakeDb,
      parsePersistedAssessmentSubmission(validSubmission),
    );
    const second = await saveHomeownerAssessment(
      fakeDb,
      parsePersistedAssessmentSubmission(validSubmission),
    );
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.assessment.reference).toBe(first.assessment.reference);
  });
});
