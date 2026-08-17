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
      boundaryGeometry: {
        type: "Polygon",
        coordinates: [
          [
            [174.7598, -36.8502],
            [174.7602, -36.8502],
            [174.7602, -36.8498],
            [174.7598, -36.8498],
            [174.7598, -36.8502],
          ],
        ],
      },
    },
    pool: {
      lengthMetres: 6.5,
      widthMetres: 3,
      rotationDegrees: 12,
      position: [174.76, -36.85],
      shellGeometry: {
        type: "Polygon",
        coordinates: [
          [
            [174.75997, -36.850015],
            [174.76003, -36.850015],
            [174.76003, -36.849985],
            [174.75997, -36.849985],
            [174.75997, -36.850015],
          ],
        ],
      },
      constructionEnvelopeGeometry: {
        type: "Polygon",
        coordinates: [
          [
            [174.75995, -36.850025],
            [174.76005, -36.850025],
            [174.76005, -36.849975],
            [174.75995, -36.849975],
            [174.75995, -36.850025],
          ],
        ],
      },
      clearancesVisible: true,
    },
    overall: {
      status: "amber",
      headline: "Further investigation required",
      summary:
        "The proposed pool appears worth progressing, but some mapped evidence requires checking.",
      recommendedStage: "Site verification",
    },
    assessments: Object.fromEntries(
      [
        [
          "pool_fit",
          "Pool fit",
          "amber",
          "The proposed pool position requires checking.",
        ],
        [
          "water_wastewater",
          "Water & wastewater",
          "unknown",
          "Water and wastewater information was not assessed.",
        ],
        [
          "stormwater",
          "Stormwater",
          "unknown",
          "Stormwater information was not assessed.",
        ],
        [
          "flooding_drainage",
          "Flooding & drainage",
          "unknown",
          "Flooding and drainage information was not assessed.",
        ],
        ["terrain", "Terrain", "unknown", "Terrain was not assessed."],
        ["planning", "Planning", "unknown", "Planning was not assessed."],
        [
          "pool_barrier",
          "Pool safety barrier",
          "amber",
          "A compliant pool barrier will be required.",
        ],
        [
          "construction_access",
          "Construction access",
          "unknown",
          "Construction access requires a site check.",
        ],
      ].map(([id, title, status, summary]) => [
        id,
        {
          id,
          title,
          status,
          headline:
            status === "amber"
              ? "Further investigation required"
              : "Not assessed",
          summary,
          details: [],
          technicalDetails: [],
        },
      ]),
    ) as unknown as SavedPreliminaryReport["assessments"],
    keyFindings: [
      {
        id: "pool_position_review",
        category: "pool_fit",
        severity: "amber",
        title: "Pool position requires checking",
        clientSummary: "Some mapped evidence is unavailable or uncertain.",
      },
    ],
    laterVerification: [
      "Current title and registered easements",
      "Exact underground service positions and depths",
      "Geotechnical and groundwater conditions",
      "Detailed construction access",
      "Final structural design",
      "Final consent and approval requirements",
    ],
    nextSteps: [
      {
        id: "confirm_pool_position",
        title: "Confirm the pool position",
        summary:
          "Review the saved mapped evidence before finalising the position.",
      },
    ],
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
  const poolShellCoordinates = [
    [
      [174.75997, -36.850015],
      [174.76003, -36.850015],
      [174.76003, -36.849985],
      [174.75997, -36.849985],
      [174.75997, -36.850015],
    ],
  ];
  const constructionEnvelopeCoordinates = [
    [
      [174.75995, -36.850025],
      [174.76005, -36.850025],
      [174.76005, -36.849975],
      [174.75995, -36.849975],
      [174.75995, -36.850025],
    ],
  ];
  return {
    idempotencyKey,
    homeowner: {
      name: "MT-249 Integration Homeowner",
      phone: "021 555 0249",
      email: "mt-249-integration@example.test",
      address: "1 MT-249 Test Street, Auckland",
      visitorType: "homeowner",
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
      boundaryGeometry: {
        type: "Polygon",
        coordinates: [
          [
            [174.7598, -36.8502],
            [174.7602, -36.8502],
            [174.7602, -36.8498],
            [174.7598, -36.8498],
            [174.7598, -36.8502],
          ],
        ],
      },
    },
    poolLayout: {
      lengthMetres: 6.5,
      widthMetres: 3,
      rotationDegrees: 12,
      position: [174.76, -36.85],
      shellGeometry: {
        type: "Polygon",
        coordinates: poolShellCoordinates,
      },
      constructionEnvelopeGeometry: {
        type: "Polygon",
        coordinates: constructionEnvelopeCoordinates,
      },
      clearancesVisible: true,
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
