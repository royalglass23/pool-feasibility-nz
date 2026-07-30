import { z } from "zod";
import {
  buildFastPoolGeometry,
  isFastPoolWithinMappedArea,
  validateFastCustomDimensions,
} from "@/modules/data-access-spike/fast-pool-placement";
import { classifyFastPoolWarning } from "@/modules/data-access-spike/fast-pool-warning";
import { renderTrustedAssessmentMap } from "@/modules/reporting/trusted-assessment-map";
import type { TrustedAssessmentSnapshot } from "./assessment-snapshot";
import {
  parsePersistedAssessmentSubmission,
  type PersistedAssessmentSubmission,
} from "./persisted-assessment";

const browserSubmissionSchema = z
  .object({
    assessmentSnapshot: z.string().min(32).max(5_500_000),
    homeowner: z
      .object({
        name: z.string().trim().min(1).max(160),
        phone: z.string().trim().min(7).max(40),
        email: z.email().max(320),
        desiredTiming: z.enum(["asap", "3_months", "6_months", "12_months"]),
        additionalInfo: z.string().trim().max(4_000).optional(),
        consentGiven: z.literal(true),
      })
      .strict(),
    poolLayout: z
      .object({
        lengthMetres: z.number().finite().min(2).max(20),
        widthMetres: z.number().finite().min(1.5).max(10),
        rotationDegrees: z.number().finite().min(-360).max(360),
        position: z.tuple([
          z.number().finite().min(160).max(180),
          z.number().finite().min(-48).max(-33),
        ]),
      })
      .strict(),
  })
  .strict();

export type BrowserAssessmentSaveRequest = z.infer<
  typeof browserSubmissionSchema
>;

export function parseBrowserAssessmentSaveRequest(
  input: unknown,
): BrowserAssessmentSaveRequest {
  return browserSubmissionSchema.parse(input);
}

export async function buildServerAssessmentSubmission(input: {
  request: BrowserAssessmentSaveRequest;
  snapshot: TrustedAssessmentSnapshot;
  now?: () => Date;
}): Promise<PersistedAssessmentSubmission> {
  const { request, snapshot } = input;
  const dimensions = validateFastCustomDimensions(
    request.poolLayout.lengthMetres,
    request.poolLayout.widthMetres,
  );
  if (!dimensions) throw new ServerAssessmentSubmissionError();

  const poolGeometry = buildFastPoolGeometry(
    request.poolLayout.position,
    dimensions.lengthMetres,
    dimensions.widthMetres,
    request.poolLayout.rotationDegrees,
  );
  const constructionEnvelope = buildFastPoolGeometry(
    request.poolLayout.position,
    dimensions.lengthMetres + 2,
    dimensions.widthMetres + 2,
    request.poolLayout.rotationDegrees,
  );
  const boundary = snapshot.fastResult.boundary;
  if (
    boundary.state === "confirmed" &&
    boundary.geometry &&
    !isFastPoolWithinMappedArea(
      request.poolLayout.position,
      {
        lengthMetres: dimensions.lengthMetres + 2,
        widthMetres: dimensions.widthMetres + 2,
      },
      request.poolLayout.rotationDegrees,
      boundary.geometry,
    )
  ) {
    throw new ServerAssessmentSubmissionError();
  }

  const warning = classifyFastPoolWarning({
    boundaryState: boundary.state,
    pool: constructionEnvelope,
    detailedChecks: snapshot.fastResult.detailedChecks,
  });
  const submittedAt = (input.now?.() ?? new Date()).toISOString();
  const mapImageDataUrl = await renderTrustedAssessmentMap({
    boundary: boundary.geometry,
    shell: poolGeometry.geometry,
    constructionEnvelope: constructionEnvelope.geometry,
    warning: warning.status,
  });

  return parsePersistedAssessmentSubmission({
    idempotencyKey: snapshot.submissionId,
    homeowner: {
      ...request.homeowner,
      address: snapshot.fastResult.resolvedAddress.fullAddress,
      consentVersion: "mt-248-v1",
      consentedAt: submittedAt,
    },
    addressEvidence: {
      selectedAddressId: snapshot.fastResult.resolvedAddress.addressId,
      formattedAddress: snapshot.fastResult.resolvedAddress.fullAddress,
      latitude: snapshot.fastResult.resolvedAddress.coordinates[1],
      longitude: snapshot.fastResult.resolvedAddress.coordinates[0],
      boundaryStatus:
        boundary.state === "loading" ? "unavailable" : boundary.state,
      boundaryAreaSquareMetres: boundary.areaSquareMetres,
      boundaryGeometry: boundary.geometry ?? undefined,
      parcelIdentifier: boundary.parcelId ?? undefined,
    },
    poolLayout: {
      ...request.poolLayout,
      shellGeometry: poolGeometry.geometry,
      constructionEnvelopeGeometry: constructionEnvelope.geometry,
    },
    layerStates:
      snapshot.fastResult.detailedChecks?.layers.map((layer) => ({
        provider: layer.evidence.provider,
        dataset: layer.evidence.dataset,
        datasetId: layer.evidence.datasetIdentifier,
        status:
          layer.state === "returned"
            ? "returned"
            : layer.state === "verified_empty"
              ? "empty"
              : layer.state === "internal_reference_only"
                ? "internal_reference_only"
                : layer.state === "provider_error" || layer.state === "timeout"
                  ? "provider_error"
                  : "unavailable",
        confidence: normalizeConfidence(layer.evidence.confidence ?? "unknown"),
        attribution: layer.evidence.attribution?.text,
        sourceUrl: layer.evidence.attribution?.url,
        retrievedAt: layer.evidence.retrievedAt,
        featureCount: layer.evidence.featureCount,
      })) ?? [],
    warnings: [
      {
        state: warning.status,
        code: `POOL_${warning.status.toUpperCase()}`,
        title: warning.label,
        message: warning.text,
      },
    ],
    recommendations: warning.recommendation
      ? [
          {
            phase: "before_concept_design",
            priority: 1,
            title: "Resolve the mapped pool warning",
            reason: warning.recommendation,
          },
        ]
      : [],
    report: {
      analysisVersion: "mt-248-v1",
      title: "Preliminary pool feasibility assessment",
      summary: warning.text,
      feasibilityState: warning.status,
      mapImageDataUrl,
      reportData: {
        recommendation:
          warning.recommendation ??
          "Review the saved mapped evidence before design.",
        preliminaryFeasibilityWording: warning.text,
        risks: [],
        actions: [],
        missingInformation: [],
        limitations: snapshot.fastResult.detailedChecks?.limitations ?? [
          "Detailed official checks have not been loaded.",
        ],
        provenance: { datasets: [] },
        assessmentSnapshot: null,
      },
    },
  });
}

export class ServerAssessmentSubmissionError extends Error {
  constructor() {
    super("INVALID_ASSESSMENT_SUBMISSION");
  }
}

function normalizeConfidence(value: string) {
  if (value === "high" || value === "medium" || value === "low") return value;
  return "unknown";
}
