import { z } from "zod";
import {
  requireOtherDetails,
  visitorContextFields,
} from "@/modules/assessment/visitor-context";
import { isValidPngMapImageDataUrl } from "@/modules/reporting/map-image";
import { reportAssessmentSnapshotSchema } from "@/modules/reporting/report-assessment-snapshot";

const isoDateTime = z.string().datetime({ offset: true });

const coordinatePosition = z.array(z.number().finite()).min(2).max(3);
const coordinates = z.union([
  coordinatePosition,
  z.array(coordinatePosition).max(10_000),
  z.array(z.array(coordinatePosition).max(10_000)).max(10_000),
  z
    .array(z.array(z.array(coordinatePosition).max(10_000)).max(10_000))
    .max(10_000),
]);
const geoJsonGeometry = z
  .object({
    type: z.enum([
      "Point",
      "MultiPoint",
      "LineString",
      "MultiLineString",
      "Polygon",
      "MultiPolygon",
      "GeometryCollection",
    ]),
    coordinates: coordinates.optional(),
    geometries: z
      .array(
        z.object({
          type: z.string().min(1).max(40),
          coordinates: coordinates.optional(),
        }),
      )
      .max(100)
      .optional(),
  })
  .superRefine((geometry, context) => {
    if (geometry.type === "GeometryCollection") {
      if (!geometry.geometries) {
        context.addIssue({
          code: "custom",
          message: "GeometryCollection requires geometries.",
        });
      }
    } else if (!geometry.coordinates) {
      context.addIssue({
        code: "custom",
        message: "Geometry requires coordinates.",
      });
    }
  });

const geometryReference = z.object({
  provider: z.string().min(1).max(120),
  dataset: z.string().min(1).max(160),
  datasetId: z.string().min(1).max(160).optional(),
  status: z.enum([
    "returned",
    "empty",
    "unavailable",
    "provider_error",
    "internal_reference_only",
  ]),
  confidence: z.enum(["high", "medium", "low", "unknown"]).optional(),
  attribution: z.string().max(500).optional(),
  sourceUrl: z.url().max(500).optional(),
  retrievedAt: isoDateTime.optional(),
  featureCount: z.number().int().nonnegative().max(100_000).optional(),
  geometry: geoJsonGeometry.optional(),
});

const poolLayout = z.object({
  lengthMetres: z.number().finite().min(2).max(20),
  widthMetres: z.number().finite().min(1.5).max(10),
  rotationDegrees: z.number().finite().min(-360).max(360),
  position: z.tuple([z.number().finite(), z.number().finite()]),
  shellGeometry: geoJsonGeometry,
  constructionEnvelopeGeometry: geoJsonGeometry,
});

const warning = z.object({
  state: z.enum(["no_warning", "needs_checking", "blocked"]),
  code: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(2_000),
});

const recommendation = z.object({
  phase: z.enum([
    "before_concept_design",
    "before_quotations",
    "before_consent_or_construction",
  ]),
  priority: z.number().int().min(0).max(100),
  title: z.string().min(1).max(200),
  reason: z.string().min(1).max(2_000),
});

const reportRisk = z.object({
  id: z.string().min(1).max(160),
  category: z.string().max(200),
  title: z.string().max(200),
  severity: z.enum(["low", "medium", "high"]),
  evidence: z.string().max(4_000),
  source: z.string().max(500),
  confidence: z.enum(["high", "limited", "unavailable"]),
  impact: z.string().max(4_000),
  action: z.string().max(4_000),
  specialistReviewRequired: z.boolean(),
});

const reportAction = z.object({
  phase: recommendation.shape.phase,
  items: z.array(z.string().max(2_000)).max(20),
});

const reportDataset = z.object({
  id: z.string().min(1).max(160),
  provider: z.string().max(120),
  dataset: z.string().max(160),
  datasetIdentifier: z.string().max(160),
  status: z.enum(["success", "available", "unavailable", "error"]),
  evidenceUse: z.enum([
    "report_allowed",
    "spike_only",
    "internal_reference",
    "unavailable",
  ]),
  retrievedAt: isoDateTime,
  datasetDate: z.string().max(100).nullable(),
  licence: z.string().max(500),
  attribution: z
    .object({ text: z.string().max(500), url: z.url().max(500) })
    .nullable(),
  confidence: z.enum(["high", "limited", "unavailable"]),
  availabilityNote: z.string().max(2_000).nullable(),
});

const reportData = z.object({
  mapImageSource: z
    .enum(["trusted_report_render", "fast_property_view_capture"])
    .optional(),
  mapVisibleLayerKeys: z.array(z.string().max(80)).max(50).optional(),
  recommendation: z.string().max(4_000),
  preliminaryFeasibilityWording: z.string().max(4_000),
  risks: z.array(reportRisk).max(50),
  actions: z.array(reportAction).max(20),
  missingInformation: z
    .array(
      z.object({
        id: z.string().max(160),
        label: z.string().max(500),
        status: z.literal("unverified"),
      }),
    )
    .max(50),
  limitations: z.array(z.string().max(2_000)).max(50),
  provenance: z.object({ datasets: z.array(reportDataset).max(50) }),
  assessmentSnapshot: reportAssessmentSnapshotSchema.nullable().optional(),
});

export const persistedAssessmentSubmissionSchema = z
  .object({
    idempotencyKey: z.string().trim().min(16).max(128),
    homeowner: z
      .object({
        name: z.string().trim().min(1).max(160),
        phone: z.string().trim().min(7).max(40),
        email: z.email().max(320),
        address: z.string().trim().min(1).max(500),
        ...visitorContextFields,
        additionalInfo: z.string().trim().max(4_000).optional(),
        consentGiven: z.literal(true),
        consentVersion: z.string().trim().min(1).max(80),
        consentedAt: isoDateTime,
      })
      .superRefine(requireOtherDetails),
    addressEvidence: z.object({
      selectedAddressId: z.string().trim().min(1).max(200),
      formattedAddress: z.string().trim().min(1).max(500),
      latitude: z.number().finite().min(-90).max(90),
      longitude: z.number().finite().min(-180).max(180),
      boundaryStatus: z.enum([
        "confirmed",
        "provisional",
        "multiple",
        "unavailable",
      ]),
      boundaryAreaSquareMetres: z
        .number()
        .finite()
        .nonnegative()
        .max(1_000_000_000)
        .nullable()
        .optional(),
      boundaryGeometry: geoJsonGeometry.optional(),
      parcelIdentifier: z.string().trim().max(200).optional(),
    }),
    poolLayout,
    layerStates: z.array(geometryReference).max(50),
    warnings: z.array(warning).max(50),
    recommendations: z.array(recommendation).max(50),
    report: z.object({
      analysisVersion: z.string().min(1).max(80),
      title: z.string().min(1).max(200),
      summary: z.string().min(1).max(8_000),
      feasibilityState: z.enum(["no_warning", "needs_checking", "blocked"]),
      mapImageDataUrl: z
        .string()
        .startsWith("data:image/png;base64,")
        .max(6_000_000)
        .refine(isValidPngMapImageDataUrl, "Report map must be a valid PNG."),
      reportData,
    }),
  })
  .superRefine((submission, context) => {
    submission.warnings.forEach((warning, index) => {
      if (warning.state !== submission.report.feasibilityState) {
        context.addIssue({
          code: "custom",
          path: ["warnings", index, "state"],
          message: "Warning state must match the overall feasibility state.",
        });
      }
    });
  });

export type PersistedAssessmentSubmission = z.infer<
  typeof persistedAssessmentSubmissionSchema
>;

export function parsePersistedAssessmentSubmission(
  input: unknown,
): PersistedAssessmentSubmission {
  return persistedAssessmentSubmissionSchema.parse(input);
}
