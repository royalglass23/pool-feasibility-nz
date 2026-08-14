import "server-only";

import pino from "pino";
import { z } from "zod";
import { getDb } from "@/db/client";
import { getAssessmentDeliveryStateById } from "@/db/repositories/homeowner-assessment-repository";
import { createPublicRateLimitedHandler } from "@/modules/rate-limit/public-rate-limit";
import { startAssessmentReportDeliveryByReference } from "@/modules/reporting/deliver-assessment-report";
import {
  SavedReportAccessTokenError,
  verifySavedReportAccessToken,
} from "@/modules/reporting/saved-report-access-token";
import {
  apiErrorResponse,
  apiJsonResponse,
  requestCorrelationId,
} from "@/shared/http/api-response";
import {
  BodyLimitError,
  readRequestBytesWithinLimit,
} from "@/shared/http/provider-runtime";

const MAX_REQUEST_BYTES = 16_000;
const requestSchema = z
  .object({ accessToken: z.string().min(32).max(4_096) })
  .strict();
const logger = pino({ base: undefined });

async function handlePublicReportDelivery(request: Request): Promise<Response> {
  const correlationId = requestCorrelationId(request);
  try {
    const bytes = await readRequestBytesWithinLimit(request, MAX_REQUEST_BYTES);
    const body = requestSchema.parse(
      JSON.parse(new TextDecoder().decode(bytes)),
    );
    const access = verifySavedReportAccessToken(body.accessToken);
    const initialState = await getAssessmentDeliveryStateById(
      getDb(),
      access.assessmentId,
    );
    if (!initialState || initialState.reference !== access.reference) {
      return apiErrorResponse(
        {
          code: "ASSESSMENT_NOT_FOUND",
          message: "The saved preliminary report is not available.",
        },
        404,
        correlationId,
        { "Cache-Control": "no-store" },
      );
    }
    await startAssessmentReportDeliveryByReference(access.reference);
    const state =
      (await getAssessmentDeliveryStateById(getDb(), access.assessmentId)) ??
      initialState;
    return apiJsonResponse({ delivery: state.delivery }, 200, correlationId, {
      "Cache-Control": "no-store",
    });
  } catch (error) {
    if (error instanceof SavedReportAccessTokenError) {
      return apiErrorResponse(
        {
          code: "REPORT_ACCESS_REQUIRED",
          message: "This report access link is invalid or has expired.",
        },
        401,
        correlationId,
        { "Cache-Control": "no-store" },
      );
    }
    if (error instanceof BodyLimitError) {
      return apiErrorResponse(
        { code: "REQUEST_TOO_LARGE", message: "The request is too large." },
        413,
        correlationId,
        { "Cache-Control": "no-store" },
      );
    }
    const invalid = error instanceof SyntaxError || error instanceof z.ZodError;
    if (!invalid) {
      logger.error({
        event: "public_report_delivery",
        outcome: "failed",
        reason:
          error instanceof Error && "code" in error
            ? String(error.code)
            : "unexpected_error",
        correlationId,
      });
    }
    return apiErrorResponse(
      {
        code: invalid ? "INVALID_REQUEST" : "DELIVERY_FAILED",
        message: invalid
          ? "Submit one valid delivery request."
          : "Report delivery could not complete. Try again shortly.",
      },
      invalid ? 400 : 502,
      correlationId,
      { "Cache-Control": "no-store" },
    );
  }
}

export const POST = createPublicRateLimitedHandler(
  "report_delivery",
  handlePublicReportDelivery,
);

export const runtime = "nodejs";
