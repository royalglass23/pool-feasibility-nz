import "server-only";
import { executeFastPropertyStagesRequest } from "@/modules/data-access-spike/execute-fast-property-stages-request";
import { executeFastPropertyDetailsRequest } from "@/modules/data-access-spike/execute-fast-property-details";
import {
  assertSnapshotAddressMatches,
  AssessmentSnapshotValidationError,
  refreshAssessmentSnapshot,
  verifyAssessmentSnapshot,
} from "@/modules/assessment/assessment-snapshot";
import { OfficialGisGateway } from "@/modules/providers/official-gis-gateway";
import {
  authorizeInternalRequest,
  internalAccessDeniedResponse,
} from "@/modules/internal-access/authorize-internal-request";
import {
  apiErrorResponse,
  apiJsonResponse,
  requestCorrelationId,
} from "@/shared/http/api-response";
import {
  BodyLimitError,
  providerTimeoutMs,
  readRequestBytesWithinLimit,
} from "@/shared/http/provider-runtime";
import { z } from "zod";

export const runtime = "nodejs";

const MAX_ASSESSMENT_SNAPSHOT_BYTES = 5_500_000;
const MAX_STAGE_REQUEST_BYTES = MAX_ASSESSMENT_SNAPSHOT_BYTES + 1_024;

const stageRequestSchema = z
  .object({
    mode: z.literal("detailed").optional(),
    addressId: z.string().trim().min(1).max(100),
    coordinates: z.tuple([
      z.number().min(160).max(180),
      z.number().min(-48).max(-33),
    ]),
    assessmentSnapshot: z.string().min(32).max(MAX_ASSESSMENT_SNAPSHOT_BYTES),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  const correlationId = requestCorrelationId(request);
  const access = authorizeInternalRequest(request);
  if (!access.allowed)
    return internalAccessDeniedResponse(access, correlationId);
  let body: unknown;
  try {
    const bytes = await readRequestBytesWithinLimit(
      request,
      MAX_STAGE_REQUEST_BYTES,
    );
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    return apiErrorResponse(
      {
        code:
          error instanceof BodyLimitError
            ? "REQUEST_TOO_LARGE"
            : "INVALID_REQUEST",
        message:
          error instanceof BodyLimitError
            ? "The property view request is too large. Search for the address again."
            : "The property imagery request is invalid. Search for the address again.",
      },
      error instanceof BodyLimitError ? 413 : 400,
      correlationId,
      { "Cache-Control": "no-store" },
    );
  }
  const parsed = stageRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiErrorResponse(
      stageRequestValidationError(body),
      400,
      correlationId,
      { "Cache-Control": "no-store" },
    );
  }
  let snapshot;
  try {
    snapshot = verifyAssessmentSnapshot(parsed.data.assessmentSnapshot);
    assertSnapshotAddressMatches(
      snapshot,
      parsed.data.addressId,
      parsed.data.coordinates,
    );
  } catch (error) {
    if (!(error instanceof AssessmentSnapshotValidationError)) throw error;
    return apiErrorResponse(
      {
        code: "INVALID_ASSESSMENT_SNAPSHOT",
        message:
          "The property assessment has expired or is invalid. Search for the address again.",
      },
      400,
      correlationId,
      { "Cache-Control": "no-store" },
    );
  }
  const gateway = new OfficialGisGateway({ timeoutMs: providerTimeoutMs() });
  const requestBody = {
    addressId: parsed.data.addressId,
    coordinates: parsed.data.coordinates,
  };
  const response =
    parsed.data.mode === "detailed"
      ? await executeFastPropertyDetailsRequest({
          body: { ...requestBody, mode: "detailed" },
          gateway,
          timeoutMs: providerTimeoutMs(),
        })
      : await executeFastPropertyStagesRequest({
          body: requestBody,
          gateway,
          basemapApiKey: process.env.LINZ_BASEMAPS_API_KEY || undefined,
          initialBoundary:
            snapshot.fastResult.datasets?.legal_parcel &&
            snapshot.fastResult.progress?.boundary &&
            snapshot.fastResult.progress.boundary !== "loading"
              ? {
                  boundary: snapshot.fastResult.boundary,
                  legalParcelEvidence:
                    snapshot.fastResult.datasets.legal_parcel,
                  progressBoundary: snapshot.fastResult.progress.boundary,
                }
              : undefined,
        });
  if (response.ok) {
    const assessmentSnapshot =
      parsed.data.mode === "detailed"
        ? refreshAssessmentSnapshot(snapshot, {
            detailedChecks:
              response.data as import("@/modules/data-access-spike/execute-fast-property-details").FastPropertyDetails,
          })
        : refreshAssessmentSnapshot(
            snapshot,
            response.data as import("@/modules/data-access-spike/fast-property-view").FastPropertyViewStage,
          );
    return apiJsonResponse(
      { data: response.data, assessmentSnapshot },
      200,
      correlationId,
      { "Cache-Control": "no-store" },
    );
  }
  return apiErrorResponse(response.error, response.status, correlationId, {
    "Cache-Control": "no-store",
  });
}

function stageRequestValidationError(body: unknown): {
  code:
    | "MISSING_ASSESSMENT_SNAPSHOT"
    | "INVALID_ASSESSMENT_SNAPSHOT"
    | "ASSESSMENT_SNAPSHOT_TOO_LARGE"
    | "INVALID_ADDRESS_POINT"
    | "INVALID_REQUEST";
  message: string;
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      code: "INVALID_REQUEST",
      message:
        "The property imagery request is invalid. Search for the address again.",
    };
  }

  if (!("assessmentSnapshot" in body)) {
    return {
      code: "MISSING_ASSESSMENT_SNAPSHOT",
      message:
        "The property view session is missing. Search for the address again.",
    };
  }

  const snapshot = body.assessmentSnapshot;
  if (typeof snapshot !== "string" || snapshot.length < 32) {
    return {
      code: "INVALID_ASSESSMENT_SNAPSHOT",
      message:
        "The property view session is invalid. Search for the address again.",
    };
  }
  if (snapshot.length > MAX_ASSESSMENT_SNAPSHOT_BYTES) {
    return {
      code: "ASSESSMENT_SNAPSHOT_TOO_LARGE",
      message:
        "The property view session is too large to continue. Search for the address again.",
    };
  }

  if (!hasValidSelectedAddressPoint(body)) {
    return {
      code: "INVALID_ADDRESS_POINT",
      message:
        "The selected address point is incomplete. Search for the address again.",
    };
  }

  return {
    code: "INVALID_REQUEST",
    message:
      "The property imagery request is invalid. Search for the address again.",
  };
}

function hasValidSelectedAddressPoint(body: object): boolean {
  if (!("addressId" in body) || !("coordinates" in body)) return false;
  if (
    typeof body.addressId !== "string" ||
    body.addressId.trim().length === 0 ||
    body.addressId.length > 100
  )
    return false;
  if (!Array.isArray(body.coordinates) || body.coordinates.length !== 2)
    return false;

  const [longitude, latitude] = body.coordinates;
  return (
    typeof longitude === "number" &&
    longitude >= 160 &&
    longitude <= 180 &&
    typeof latitude === "number" &&
    latitude >= -48 &&
    latitude <= -33
  );
}
