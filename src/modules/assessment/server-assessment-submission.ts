import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import {
  buildConstructabilitySnapshot,
  constructabilityAnswersSchema,
  ConstructabilityEvidenceError,
} from "./constructability-evidence";
import { homeownerContactSchema } from "./homeowner-contact";
import type { Geometry } from "geojson";
import {
  buildFastPoolGeometry,
  fastPoolConstructionEnvelopeDimensions,
  isFastPoolWithinMappedArea,
  validateFastCustomDimensions,
} from "@/modules/data-access-spike/fast-pool-placement";
import { classifyFastPoolWarning } from "@/modules/data-access-spike/fast-pool-warning";
import { buildFastReportAssessment } from "@/modules/reporting/build-fast-report-assessment";
import { buildReportAssessmentSnapshot } from "@/modules/reporting/report-assessment-snapshot";
import { isValidPngMapImageDataUrl } from "@/modules/reporting/map-image";
import { AUCKLAND_DEM_HOMEOWNER_REPORT_APPROVED } from "@/modules/providers/linz/auckland-dem-source-contract";
import { aucklandDemReportEligibility } from "@/modules/providers/linz/auckland-dem-report-eligibility";
import { assessSelectedPoolTerrain } from "@/modules/terrain/assess-selected-pool-terrain";
import type {
  PropertyTerrainAssessment,
  PropertyTerrainGateway,
  PropertyTerrainSource,
} from "@/modules/terrain/property-terrain";
import type { TrustedAssessmentSnapshot } from "./assessment-snapshot";
import { suggestAccessRouteFromProperty } from "@/modules/spatial/suggest-access-route";
import { analyseAccessRouteFromProperty } from "@/modules/spatial/analyse-access-route";
import { poolLayoutSchema } from "./pool-layout-schema";
import {
  parsePersistedAssessmentSubmission,
  type PersistedAssessmentSubmission,
} from "./persisted-assessment";

const browserSubmissionSchema = z
  .object({
    assessmentSnapshot: z.string().min(32).max(5_500_000),
    mapImageDataUrl: z
      .string()
      .startsWith("data:image/png;base64,")
      .max(6_000_000)
      .refine(isValidPngMapImageDataUrl, "Report map must be a valid PNG."),
    mapVisibleLayerKeys: z
      .array(z.string().trim().min(1).max(80))
      .max(50)
      .default([]),
    homeowner: homeownerContactSchema,
    constructability: constructabilityAnswersSchema.optional(),
    poolLayout: poolLayoutSchema.extend({
      clearancesVisible: z.boolean().default(true),
    }),
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

export function assertConstructabilityMatchesSnapshot(
  request: BrowserAssessmentSaveRequest,
  snapshot: TrustedAssessmentSnapshot,
): void {
  if (
    Boolean(request.constructability) !== Boolean(snapshot.constructability) ||
    (snapshot.lockedEstimatedDepthMetres !== undefined &&
      snapshot.constructability?.answers.estimatedDepthMetres !==
        snapshot.lockedEstimatedDepthMetres) ||
    (request.constructability &&
      !isDeepStrictEqual(
        request.constructability,
        snapshot.constructability!.answers,
      ))
  ) {
    throw new ConstructabilityEvidenceError();
  }
}

export async function buildServerAssessmentSubmission(input: {
  request: BrowserAssessmentSaveRequest;
  snapshot: TrustedAssessmentSnapshot;
  terrainGateway?: PropertyTerrainGateway;
  now?: () => Date;
}): Promise<PersistedAssessmentSubmission> {
  const { request, snapshot } = input;
  const dimensions = validateFastCustomDimensions(
    request.poolLayout.lengthMetres,
    request.poolLayout.widthMetres,
  );
  if (!dimensions) throw new ServerAssessmentSubmissionError();
  const constructionEnvelopeDimensions =
    fastPoolConstructionEnvelopeDimensions(dimensions);

  const poolGeometry = buildFastPoolGeometry(
    request.poolLayout.position,
    dimensions.lengthMetres,
    dimensions.widthMetres,
    request.poolLayout.rotationDegrees,
  );
  const constructionEnvelope = buildFastPoolGeometry(
    request.poolLayout.position,
    constructionEnvelopeDimensions.lengthMetres,
    constructionEnvelopeDimensions.widthMetres,
    request.poolLayout.rotationDegrees,
  );
  const boundary = snapshot.fastResult.boundary;
  if (
    boundary.geometry &&
    !isFastPoolWithinMappedArea(
      request.poolLayout.position,
      constructionEnvelopeDimensions,
      request.poolLayout.rotationDegrees,
      boundary.geometry,
    )
  ) {
    throw new ServerAssessmentSubmissionError();
  }

  const terrain: PropertyTerrainAssessment | undefined = input.terrainGateway
    ? boundary.geometry
      ? await input.terrainGateway.assessParcel(
          boundary.geometry,
          constructionEnvelope.geometry,
        )
      : {
          status: "needs_checking",
          reasons: ["The mapped property parcel is unavailable."],
        }
    : snapshot.fastResult.detailedChecks?.terrain;

  const warning = classifyFastPoolWarning({
    boundaryState: boundary.state,
    pool: constructionEnvelope,
    detailedChecks: snapshot.fastResult.detailedChecks,
  });
  const submittedAt = (input.now?.() ?? new Date()).toISOString();
  const reportAssessment = buildFastReportAssessment(
    snapshot.fastResult,
    submittedAt,
  );
  assertConstructabilityMatchesSnapshot(request, snapshot);
  if (snapshot.constructability?.evidence.routePolicyVersion === 1) {
    const expected = suggestAccessRouteFromProperty(
      snapshot.fastResult,
      request.poolLayout,
    );
    if (
      !isDeepStrictEqual(
        snapshot.constructability.evidence.suggestedRoute,
        expected.geometry,
      ) ||
      (snapshot.constructability.answers.route.provenance === "confirmed" &&
        (expected.confidence !== "credible" ||
          !isDeepStrictEqual(
            snapshot.constructability.answers.route.geometry,
            expected.geometry,
          ))) ||
      (snapshot.constructability.answers.route.geometry &&
        !isDeepStrictEqual(
          snapshot.constructability.evidence.routeFacts,
          analyseAccessRouteFromProperty(
            snapshot.fastResult,
            snapshot.constructability.answers.route.geometry,
          ),
        ))
    )
      throw new ConstructabilityEvidenceError();
  }
  const constructability = request.constructability
    ? buildConstructabilitySnapshot({
        answers: snapshot.constructability!.answers,
        ...snapshot.constructability!.evidence,
        excavation: {
          dimensions,
          terrainAdjustment:
            terrain?.status === "measured" &&
            aucklandDemReportEligibility(
              terrain.source,
              AUCKLAND_DEM_HOMEOWNER_REPORT_APPROVED,
            ) === "approved"
              ? "available_separate"
              : "unavailable",
        },
      })
    : undefined;
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
      clearancesVisible: request.poolLayout.clearancesVisible,
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
        geometry: persistedLayerGeometry(layer.geometry),
      })) ?? [],
    warnings: [
      {
        state: warning.status,
        code: `POOL_${warning.status.toUpperCase()}`,
        title: warning.label,
        message: warning.text,
      },
    ],
    recommendations: reportRecommendations(warning, reportAssessment),
    report: {
      analysisVersion:
        reportAssessment?.feasibilityAssessment.analysisVersion ?? "mt-248-v1",
      title: "Preliminary pool feasibility assessment",
      summary: warning.text,
      feasibilityState: warning.status,
      mapImageDataUrl: request.mapImageDataUrl,
      reportData: {
        mapImageSource: "fast_property_view_capture",
        mapVisibleLayerKeys: request.mapVisibleLayerKeys,
        recommendation:
          warning.recommendation ??
          reportAssessment?.recommendation ??
          "Review the saved mapped evidence before design.",
        preliminaryFeasibilityWording:
          reportAssessment?.preliminaryFeasibilityWording ?? warning.text,
        risks: reportAssessment?.risks ?? [],
        actions: reportAssessment?.actions ?? [],
        missingInformation: reportAssessment?.missingInformation ?? [],
        limitations: reportAssessment?.limitations ??
          snapshot.fastResult.detailedChecks?.limitations ?? [
            "Detailed official checks have not been loaded.",
          ],
        provenance: reportAssessment?.provenance ?? { datasets: [] },
        placementLayerFindings: warning.placementLayerFindings ?? [],
        terrain: reportTerrain(
          terrain,
          constructionEnvelope.geometry,
          Boolean(input.terrainGateway),
        ),
        assessmentSnapshot: reportAssessment
          ? buildReportAssessmentSnapshot(reportAssessment)
          : null,
        constructability,
      },
    },
  });
}

function reportTerrain(
  terrain: PropertyTerrainAssessment | undefined,
  constructionEnvelope: Extract<Geometry, { type: "Polygon" }>,
  bufferedProposedPool: boolean,
): PersistedAssessmentSubmission["report"]["reportData"]["terrain"] {
  if (!terrain) return undefined;
  if (terrain.status === "needs_checking") {
    return { status: "needs_checking", reasons: terrain.reasons };
  }
  const constructionEnvelopeTerrain =
    !bufferedProposedPool && terrain.slopeSamples?.length
      ? assessSelectedPoolTerrain({
          samples: terrain.slopeSamples,
          footprint: constructionEnvelope,
        })
      : null;
  return persistMeasuredTerrain(
    terrain,
    constructionEnvelopeTerrain,
    bufferedProposedPool,
  );
}

function persistMeasuredTerrain(
  terrain: Extract<PropertyTerrainAssessment, { status: "measured" }>,
  constructionEnvelopeTerrain: ReturnType<
    typeof assessSelectedPoolTerrain
  > | null,
  bufferedProposedPool: boolean,
): PersistedAssessmentSubmission["report"]["reportData"]["terrain"] {
  return {
    status: "measured",
    ...(bufferedProposedPool
      ? { analysisArea: "buffered_proposed_pool" as const }
      : {}),
    reportEligibility: aucklandDemReportEligibility(
      terrain.source,
      AUCKLAND_DEM_HOMEOWNER_REPORT_APPROVED,
    ),
    averageSlopeDegrees: terrain.averageSlopeDegrees,
    upperSlopeDegrees: terrain.upperSlopeDegrees,
    estimatedFallMetres: terrain.estimatedFallMetres,
    downhillBearingDegrees: terrain.downhillBearingDegrees,
    downhillDirection: terrain.downhillDirection,
    confidence: terrain.confidence,
    constructionEnvelopeTerrain,
    source: persistTerrainSource(terrain.source, bufferedProposedPool),
  };
}

function persistTerrainSource(
  source: PropertyTerrainSource,
  bufferedProposedPool: boolean,
) {
  return {
    provider: source.provider,
    dataset: source.dataset,
    datasetIdentifier: source.datasetIdentifier,
    status: source.status,
    licenceStatus: source.licenceStatus,
    evidenceUse: source.evidenceUse,
    datasetDate: source.datasetDate,
    licence: source.licence,
    licenceUrl: source.licenceUrl ?? null,
    attribution: source.attribution,
    retrievedAt: source.retrievedAt,
    geometryUsed: source.geometryUsed,
    attributesUsed: source.attributesUsed,
    evidenceType: source.evidenceType,
    confidence: source.confidence,
    derivedProductNotice: bufferedProposedPool
      ? ("Elevation data was clipped to the buffered proposed-pool area and used to derive indicative slope measurements." as const)
      : ("Elevation data was clipped to the assessed property and used to derive indicative slope measurements." as const),
    contributingAssets: (source.contributingAssets ?? []).map((asset) => ({
      dataset: asset.dataset,
      datasetIdentifier: asset.datasetIdentifier,
      datasetDate: asset.datasetDate ?? null,
      stacCollectionUrl: asset.stacCollectionUrl,
      assetUrl: asset.assetUrl,
      stacItemUrl: asset.stacItemUrl,
      assetChecksum: asset.assetChecksum,
      assetUpdatedAt: asset.assetUpdatedAt,
      retrievedAt: asset.retrievedAt,
    })),
  };
}

function persistedLayerGeometry(
  collection: NonNullable<
    TrustedAssessmentSnapshot["fastResult"]["detailedChecks"]
  >["layers"][number]["geometry"],
): PersistedAssessmentSubmission["layerStates"][number]["geometry"] {
  if (!collection) return undefined;
  const geometries = collection.features.flatMap((feature) =>
    flattenGeometryCollection(feature.geometry),
  );
  if (geometries.length === 0) return undefined;
  return {
    type: "GeometryCollection",
    geometries,
  } as PersistedAssessmentSubmission["layerStates"][number]["geometry"];
}

function flattenGeometryCollection(geometry: Geometry): Geometry[] {
  return geometry.type === "GeometryCollection"
    ? geometry.geometries.flatMap(flattenGeometryCollection)
    : [geometry];
}

function reportRecommendations(
  warning: ReturnType<typeof classifyFastPoolWarning>,
  assessment: ReturnType<typeof buildFastReportAssessment>,
) {
  const warningRecommendation = warning.recommendation
    ? [
        {
          phase: "before_concept_design" as const,
          priority: 1,
          title: "Resolve the mapped pool warning",
          reason: warning.recommendation,
        },
      ]
    : [];
  const assessmentRecommendations =
    assessment?.actions.flatMap((group, groupIndex) =>
      group.items.slice(0, 2).map((item, itemIndex) => ({
        phase: group.phase,
        priority: warningRecommendation.length + groupIndex * 2 + itemIndex + 1,
        title: item,
        reason: item,
      })),
    ) ?? [];
  return [...warningRecommendation, ...assessmentRecommendations];
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
