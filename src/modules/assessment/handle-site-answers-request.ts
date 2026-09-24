import "server-only";
import { z } from "zod";
import {
  attachConstructabilityAnswers,
  AssessmentSnapshotValidationError,
  verifyAssessmentSnapshot,
} from "./assessment-snapshot";
import { constructabilityAnswersSchema } from "./constructability-evidence";
import { DEFAULT_ESTIMATED_POOL_DEPTH_METRES } from "./estimated-pool-depth";
import { poolLayoutSchema } from "./pool-layout-schema";
import { suggestAccessRouteFromProperty } from "@/modules/spatial/suggest-access-route";
import { analyseAccessRouteFromProperty } from "@/modules/spatial/analyse-access-route";
import {
  apiErrorResponse,
  apiJsonResponse,
  requestCorrelationId,
} from "@/shared/http/api-response";
import {
  BodyLimitError,
  readRequestBytesWithinLimit,
} from "@/shared/http/provider-runtime";

const requestSchema = z
  .object({
    assessmentSnapshot: z.string().min(32).max(5_500_000),
    accessConditions: constructabilityAnswersSchema.shape.accessConditions,
    nearbyFeatures: constructabilityAnswersSchema.shape.nearbyFeatures,
    sideClearanceMillimetres: z.number().int().min(200).max(600).default(300),
    routeResponse: z
      .enum(["suggested", "confirm", "adjust", "not_sure"])
      .optional(),
    adjustedRoute:
      constructabilityAnswersSchema.shape.route.shape.geometry.optional(),
    poolLayout: poolLayoutSchema.optional(),
  })
  .strict();

export async function handleSiteAnswersRequest(
  request: Request,
): Promise<Response> {
  const correlationId = requestCorrelationId(request);
  try {
    const bytes = await readRequestBytesWithinLimit(request, 5_501_024);
    const parsed = requestSchema.parse(
      JSON.parse(new TextDecoder().decode(bytes)),
    );
    const snapshot = verifyAssessmentSnapshot(parsed.assessmentSnapshot);
    const previous = snapshot.constructability;
    if (Boolean(parsed.routeResponse) !== Boolean(parsed.poolLayout))
      throw new AssessmentSnapshotValidationError();
    const suggestion = parsed.poolLayout
      ? suggestAccessRouteFromProperty(snapshot.fastResult, parsed.poolLayout)
      : null;
    if (
      (parsed.routeResponse === "suggested" ||
        parsed.routeResponse === "confirm") &&
      suggestion?.confidence !== "credible"
    )
      throw new AssessmentSnapshotValidationError();
    if (parsed.routeResponse === "adjust") {
      if (
        suggestion?.confidence !== "credible" ||
        !parsed.adjustedRoute ||
        parsed.adjustedRoute.coordinates.length < 3 ||
        JSON.stringify(parsed.adjustedRoute.coordinates[0]) !==
          JSON.stringify(suggestion.geometry.coordinates[0]) ||
        JSON.stringify(parsed.adjustedRoute.coordinates.at(-1)) !==
          JSON.stringify(suggestion.geometry.coordinates.at(-1))
      )
        throw new AssessmentSnapshotValidationError();
    } else if (parsed.adjustedRoute !== undefined) {
      throw new AssessmentSnapshotValidationError();
    }
    const route =
      parsed.routeResponse === "adjust" && parsed.adjustedRoute
        ? {
            provenance: "user-supplied" as const,
            geometry: parsed.adjustedRoute,
          }
        : parsed.routeResponse === "confirm" && suggestion?.geometry
          ? { provenance: "confirmed" as const, geometry: suggestion.geometry }
          : parsed.routeResponse === "suggested" && suggestion?.geometry
            ? {
                provenance: "suggested" as const,
                geometry: suggestion.geometry,
              }
            : parsed.routeResponse === "not_sure"
              ? { provenance: "uncertain" as const, geometry: null }
              : (previous?.answers.route ?? {
                  provenance: "uncertain" as const,
                  geometry: null,
                });
    const answers = constructabilityAnswersSchema.parse({
      version: 1,
      estimatedDepthMetres:
        snapshot.lockedEstimatedDepthMetres ??
        previous?.answers.estimatedDepthMetres ??
        DEFAULT_ESTIMATED_POOL_DEPTH_METRES,
      excavationSideAllowanceMetres: parsed.sideClearanceMillimetres / 1_000,
      route,
      accessConditions: parsed.accessConditions,
      nearbyFeatures: parsed.nearbyFeatures,
    });
    const assessmentSnapshot = attachConstructabilityAnswers(snapshot, {
      answers,
      evidence: {
        suggestedRoute: suggestion
          ? suggestion.geometry
          : (previous?.evidence.suggestedRoute ?? null),
        ...(suggestion || previous?.evidence.routePolicyVersion === 1
          ? { routePolicyVersion: 1 as const }
          : {}),
        ...(route.geometry
          ? {
              routeFacts: analyseAccessRouteFromProperty(
                snapshot.fastResult,
                route.geometry,
              ),
            }
          : {}),
        mappedEvidence: previous?.evidence.mappedEvidence ?? [],
        providerAvailability: previous?.evidence.providerAvailability ?? [],
        assumptions: suggestion
          ? [
              ...(previous?.evidence.assumptions ?? []).filter(
                (item) => !item.startsWith("Access route policy v1:"),
              ),
              `Access route policy v1: ${suggestion.reason}`,
            ]
          : (previous?.evidence.assumptions ?? []),
      },
    });
    return apiJsonResponse(
      {
        assessmentSnapshot,
        answers,
        routeFacts: route.geometry
          ? analyseAccessRouteFromProperty(snapshot.fastResult, route.geometry)
          : null,
      },
      200,
      correlationId,
      {
        "Cache-Control": "no-store",
      },
    );
  } catch (error) {
    const tooLarge =
      error instanceof BodyLimitError && error.code === "BODY_TOO_LARGE";
    if (!(
      error instanceof SyntaxError ||
      error instanceof z.ZodError ||
      error instanceof AssessmentSnapshotValidationError ||
      error instanceof BodyLimitError
    ))
      throw error;
    return apiErrorResponse(
      {
        code: tooLarge ? "REQUEST_TOO_LARGE" : "INVALID_SITE_ANSWERS",
        message: tooLarge
          ? "The Site answers request is too large."
          : "Check both Site answers and try again. If the property check expired, search for the address again.",
      },
      tooLarge ? 413 : 400,
      correlationId,
      { "Cache-Control": "no-store" },
    );
  }
}
