import type { PersistedAssessmentSubmission } from "@/modules/assessment/persisted-assessment";
import type { SavedPreliminaryReport } from "@/modules/reporting/preliminary-report";

export const TEST_MAP_IMAGE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGL5//8/AAAA//+rxzhLAAAABklEQVQDAAYOAwJctCtXAAAAAElFTkSuQmCC";

type ReportOverrides = Omit<
  Partial<SavedPreliminaryReport>,
  "property" | "pool"
> & {
  property?: Partial<SavedPreliminaryReport["property"]>;
  pool?: Partial<SavedPreliminaryReport["pool"]>;
};

export function buildTestPreliminaryReport(
  overrides: ReportOverrides = {},
): SavedPreliminaryReport {
  const base: SavedPreliminaryReport = {
    reference: "GF-2026-000123",
    generatedAt: "2026-07-29T02:03:04.000Z",
    title: "Preliminary pool feasibility assessment",
    summary: "Some mapped evidence is unavailable or uncertain.",
    warningState: "needs_checking",
    property: {
      address: "1 Test Street, Auckland",
      boundaryStatus: "provisional",
      boundaryConfidence: "medium",
      boundaryAreaSquareMetres: 842,
      parcelIdentifier: "NA123/45",
    },
    pool: {
      lengthMetres: 6.5,
      widthMetres: 3,
      rotationDegrees: 12,
    },
    warnings: [
      {
        state: "needs_checking",
        code: "POOL_NEEDS_CHECKING",
        title: "Pool placement needs checking",
        message: "Some mapped evidence is unavailable or uncertain.",
      },
    ],
    recommendations: [],
    mainRecommendation: "Confirm the mapped evidence.",
    decision: {
      score: null,
      classification: "indeterminate",
      confidence: "unknown",
    },
    scenarios: [
      {
        label: "Compact",
        status: "insufficient_data",
        usableAreaSquareMetres: null,
      },
      {
        label: "Standard",
        status: "insufficient_data",
        usableAreaSquareMetres: null,
      },
      {
        label: "Large",
        status: "insufficient_data",
        usableAreaSquareMetres: null,
      },
    ],
    categories: [
      ["available_space", 25],
      ["underground_services", 20],
      ["flooding_and_drainage", 20],
      ["terrain_and_slope", 15],
      ["planning_constraints", 10],
      ["construction_access", 10],
    ].map(([id, maximumPoints]) => ({
      id: String(id),
      maximumPoints: Number(maximumPoints),
      awardedPoints: null,
      status: "unknown" as const,
      rationale: "Not evaluated in this test fixture.",
    })),
    risks: [],
    actions: [],
    missingInformation: [],
    layers: [],
    sources: [],
    assumptions: ["Preliminary assessment only."],
    limitations: ["Detailed official checks have not been loaded."],
    mapImageDataUrl: TEST_MAP_IMAGE_DATA_URL,
  };

  return {
    ...base,
    ...overrides,
    property: { ...base.property, ...overrides.property },
    pool: { ...base.pool, ...overrides.pool },
  };
}

export function buildTestPersistedAssessmentSubmission(
  idempotencyKey: string,
): PersistedAssessmentSubmission {
  return {
    idempotencyKey,
    homeowner: {
      name: "MT-249 Integration Homeowner",
      phone: "021 555 0249",
      email: "mt-249-integration@example.test",
      address: "1 MT-249 Test Street, Auckland",
      desiredTiming: "3_months",
      consentGiven: true,
      consentVersion: "mt-249-integration-v1",
      consentedAt: "2026-07-29T02:03:04.000Z",
    },
    addressEvidence: {
      selectedAddressId: "mt-249-integration-address",
      formattedAddress: "1 MT-249 Test Street, Auckland",
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
    layerStates: [],
    warnings: [
      {
        state: "needs_checking",
        code: "POOL_NEEDS_CHECKING",
        title: "Pool placement needs checking",
        message: "Some mapped evidence is unavailable or uncertain.",
      },
    ],
    recommendations: [],
    report: {
      analysisVersion: "mt-249-integration-v1",
      title: "Preliminary pool feasibility assessment",
      summary: "Some mapped evidence is unavailable or uncertain.",
      feasibilityState: "needs_checking",
      mapImageDataUrl: TEST_MAP_IMAGE_DATA_URL,
      reportData: {
        recommendation: "Confirm the mapped evidence.",
        preliminaryFeasibilityWording: "Preliminary assessment only.",
        risks: [],
        actions: [],
        missingInformation: [],
        limitations: ["Detailed official checks have not been loaded."],
        provenance: { datasets: [] },
      },
    },
  };
}
