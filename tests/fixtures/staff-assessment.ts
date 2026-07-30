import {
  buildTestPreliminaryReport,
  TEST_MAP_IMAGE_DATA_URL,
} from "./preliminary-report";
import type {
  StaffAssessmentDetail,
  StaffAssessmentSummary,
} from "@/modules/staff/staff-assessment-read-model";

export const SAVED_MAP_IMAGE_DATA_URL = TEST_MAP_IMAGE_DATA_URL;

export const savedPreliminaryReport = buildTestPreliminaryReport({
  reference: "GF-2026-000042",
  generatedAt: "2026-07-29T01:30:00.000Z",
  title: "Preliminary pool feasibility assessment",
  summary: "A blocked saved assessment.",
  warningState: "blocked",
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
  desiredTiming: "3_months",
  additionalInfo: "A narrow access path.",
  boundaryStatus: "provisional",
  feasibilityState: "blocked",
  emailDeliveryState: "sent",
  forwardingState: "pending",
  createdAt: new Date("2026-07-29T01:30:00.000Z"),
  report: savedPreliminaryReport,
} satisfies StaffAssessmentDetail;

export const staffAssessmentSummaries = [
  {
    id: "assessment-new",
    reference: "GF-2026-000042",
    homeownerName: "Jane Homeowner",
    homeownerAddress: "1 Test Street, Auckland",
    desiredTiming: "3_months",
    feasibilityState: "blocked",
    createdAt: new Date("2026-07-29T01:30:00.000Z"),
    poolLayout: {
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
    homeownerAddress: "2 Earlier Road, Auckland",
    desiredTiming: "12_months",
    feasibilityState: "no_warning",
    createdAt: new Date("2026-07-28T01:30:00.000Z"),
    poolLayout: {
      lengthMetres: 4,
      widthMetres: 2.4,
      rotationDegrees: 0,
    },
    evidenceCount: 3,
  },
] satisfies StaffAssessmentSummary[];
