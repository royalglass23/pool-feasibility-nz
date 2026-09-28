import {
  buildTestPreliminaryReport,
  TEST_MAP_IMAGE_DATA_URL,
} from "./preliminary-report";
import { buildConstructabilitySnapshot } from "@/modules/assessment/constructability-evidence";
import type {
  StaffAssessmentDetail,
  StaffAssessmentSummary,
} from "@/modules/staff/staff-assessment-read-model";
import { projectStaffConstructabilityEvidence } from "@/modules/staff/staff-assessment-read-model";

export const SAVED_MAP_IMAGE_DATA_URL = TEST_MAP_IMAGE_DATA_URL;

export const savedPreliminaryReport = buildTestPreliminaryReport({
  reference: "GF-2026-000042",
  generatedAt: "2026-07-29T01:30:00.000Z",
  title: "Preliminary pool feasibility assessment",
  summary: "A blocked saved assessment.",
  warningState: "blocked",
  overall: {
    status: "red",
    headline: "Potential constraint identified",
    summary:
      "Mapped wastewater infrastructure may affect the proposed pool position. Review this issue before progressing with the current layout.",
    recommendedStage: "Review pool position",
  },
  keyFindings: [
    {
      id: "wastewater_conflict",
      category: "wastewater",
      severity: "red",
      title: "Wastewater infrastructure near the proposed pool",
      clientSummary:
        "Mapped wastewater infrastructure may affect the proposed pool position and should be checked before the layout is finalised.",
    },
  ],
  nextSteps: [
    {
      id: "verify_wastewater",
      title: "Verify water and wastewater infrastructure",
      summary:
        "Confirm the wastewater asset location before the position is finalised.",
    },
  ],
  property: {
    address: "1 Test Street, Auckland",
    boundaryStatus: "provisional",
    boundaryConfidence: "medium",
    boundaryAreaSquareMetres: 842,
    parcelIdentifier: "parcel-42",
  },
  pool: {
    lengthMetres: 6.5,
    widthMetres: 3,
    rotationDegrees: 24,
  },
  warnings: [
    {
      state: "blocked",
      code: "SERVICE_CONFLICT",
      title: "Mapped wastewater conflict",
      message: "The saved pool overlaps mapped wastewater infrastructure.",
    },
  ],
  recommendations: [
    {
      phase: "before_concept_design",
      priority: 1,
      title: "Move the pool",
      reason:
        "Move the pool, or obtain an engineer-designed solution accepted by the relevant council or service owner.",
    },
  ],
  layers: [
    {
      provider: "Auckland Council",
      dataset: "Wastewater assets",
      state: "returned",
      confidence: "high",
      attribution: "Auckland Council GeoMaps",
      sourceUrl: null,
    },
  ],
  limitations: ["Preliminary desktop assessment only."],
  mapImageDataUrl: SAVED_MAP_IMAGE_DATA_URL,
});

export const staffAssessmentDetail = {
  id: "assessment-new",
  reference: savedPreliminaryReport.reference,
  status: "new_enquiry",
  homeownerName: "Jane Homeowner",
  homeownerPhone: "021 555 1234",
  homeownerEmail: "jane@example.com",
  homeownerAddress: "1 Test Street, Auckland",
  builderCompanyName: null,
  visitorType: "homeowner",
  visitorTypeOtherDetail: null,
  reportAudience: "homeowner",
  desiredTiming: "3_months",
  desiredTimingOtherDetail: null,
  additionalInfo: "A narrow access path.",
  boundaryStatus: "provisional",
  poolLayout: {
    layoutId: "compact",
    layoutName: "Compact",
    lengthMetres: 6.5,
    widthMetres: 3,
  },
  feasibilityState: "blocked",
  emailDeliveryState: "sent",
  forwardingState: "pending",
  createdAt: new Date("2026-07-29T01:30:00.000Z"),
  report: savedPreliminaryReport,
  constructabilityEvidence: {
    status: "not_assessed",
    reason:
      "Site constructability evidence was not captured for this assessment.",
  },
} satisfies StaffAssessmentDetail;

const route = {
  type: "LineString" as const,
  coordinates: [
    [174.7598, -36.8502],
    [174.76, -36.85],
  ] as [number, number][],
};

export const savedConstructabilitySnapshot = buildConstructabilitySnapshot({
  answers: {
    version: 1,
    estimatedDepthMetres: 1.7,
    route: { provenance: "confirmed", geometry: route },
    accessConditions: ["gate_or_narrow_passage"],
    nearbyFeatures: ["not_sure"],
  },
  suggestedRoute: route,
  routePolicyVersion: 1,
  routeFacts: {
    valid: true,
    length: { status: "assessed", value: 18.4 },
    elevationChange: { status: "not_assessed", reason: "data_unavailable" },
    steepestGradient: { status: "assessed", value: 8.2 },
    parcelDeparture: { status: "assessed", value: false },
    buildings: { status: "assessed", value: true },
    services: { status: "not_assessed", reason: "data_unavailable" },
  },
  mappedEvidence: [
    {
      id: "mapped-building-intersection",
      category: "access_excavation",
      status: "concern",
      provider: "Auckland Council",
      dataset: "Building outlines",
    },
    {
      id: "terrain-unavailable",
      category: "terrain_ground",
      status: "unavailable",
      provider: "LINZ",
      dataset: "Auckland DEM",
    },
  ],
  providerAvailability: [
    {
      category: "access_excavation",
      provider: "Auckland Council",
      dataset: "Building outlines",
      status: "available",
    },
    {
      category: "terrain_ground",
      provider: "LINZ",
      dataset: "Auckland DEM",
      status: "error",
    },
  ],
  assumptions: ["Access route facts use the saved confirmed route."],
  excavation: {
    dimensions: { lengthMetres: 6.5, widthMetres: 3 },
    terrainAdjustment: "unavailable",
  },
});

export const savedConstructabilityReport = buildTestPreliminaryReport({
  reference: savedPreliminaryReport.reference,
  generatedAt: savedPreliminaryReport.generatedAt,
  constructability: savedConstructabilitySnapshot,
});

export const staffAssessmentWithConstructabilityEvidence = {
  ...staffAssessmentDetail,
  report: savedConstructabilityReport,
  constructabilityEvidence: projectStaffConstructabilityEvidence(
    savedConstructabilitySnapshot,
  ),
} satisfies StaffAssessmentDetail;

export const staffAssessmentSummaries = [
  {
    id: "assessment-new",
    reference: "GF-2026-000042",
    homeownerName: "Jane Homeowner",
    homeownerPhone: "021 555 1234",
    homeownerAddress: "1 Test Street, Auckland",
    desiredTiming: "3_months",
    feasibilityState: "blocked",
    createdAt: new Date("2026-07-29T01:30:00.000Z"),
    poolLayout: {
      layoutId: "compact",
      layoutName: "Compact",
      lengthMetres: 6.5,
      widthMetres: 3,
      rotationDegrees: 24,
    },
    evidenceCount: 1,
  },
  {
    id: "assessment-old",
    reference: "GF-2026-000041",
    homeownerName: "Older Homeowner",
    homeownerPhone: "021 555 9876",
    homeownerAddress: "2 Earlier Road, Auckland",
    desiredTiming: "12_months",
    feasibilityState: "no_warning",
    createdAt: new Date("2026-07-28T01:30:00.000Z"),
    poolLayout: {
      layoutId: "plunge",
      layoutName: "Plunge",
      lengthMetres: 4,
      widthMetres: 2.4,
      rotationDegrees: 0,
    },
    evidenceCount: 3,
  },
] satisfies StaffAssessmentSummary[];
