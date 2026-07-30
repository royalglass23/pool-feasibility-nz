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
        message: "Submit one selected address point.",
      },
      error instanceof BodyLimitError ? 413 : 400,
      correlationId,
      { "Cache-Control": "no-store" },
    );
  }
  const parsed = stageRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiErrorResponse(
      {
        code: "INVALID_REQUEST",
        message: "Submit one selected address point.",
      },
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
        code: "INVALID_REQUEST",
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
    mode: parsed.data.mode,
    addressId: parsed.data.addressId,
    coordinates: parsed.data.coordinates,
  };
  const response =
    parsed.data.mode === "detailed"
      ? await executeFastPropertyDetailsRequest({
          body: requestBody,
          gateway,
          timeoutMs: providerTimeoutMs(),
        })
      : await executeFastPropertyStagesRequest({
          body: requestBody,
          gateway,
          basemapApiKey: process.env.LINZ_BASEMAPS_API_KEY || undefined,
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
