import "server-only";

import { z } from "zod";
import { getDb } from "@/db/client";
import { getAssessmentDeliveryStateById } from "@/db/repositories/homeowner-assessment-repository";
import { createPublicRateLimitedHandler } from "@/modules/rate-limit/public-rate-limit";
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

async function handlePublicReportDeliveryStatus(
  request: Request,
): Promise<Response> {
  const correlationId = requestCorrelationId(request);
  try {
    const bytes = await readRequestBytesWithinLimit(request, MAX_REQUEST_BYTES);
    const body = requestSchema.parse(
      JSON.parse(new TextDecoder().decode(bytes)),
    );
    const access = verifySavedReportAccessToken(body.accessToken);
    const state = await getAssessmentDeliveryStateById(
      getDb(),
      access.assessmentId,
    );
    if (!state || state.reference !== access.reference) {
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
    return apiJsonResponse({ delivery: state.delivery }, 200, correlationId, {
      "Cache-Control": "no-store",
    });
  } catch (error) {
    const invalid = error instanceof SyntaxError || error instanceof z.ZodError;
    const status =
      error instanceof SavedReportAccessTokenError
        ? 401
        : error instanceof BodyLimitError
          ? 413
          : invalid
            ? 400
            : 502;
    return apiErrorResponse(
      {
        code:
          status === 401
            ? "REPORT_ACCESS_REQUIRED"
            : status === 413
              ? "REQUEST_TOO_LARGE"
              : status === 400
                ? "INVALID_REQUEST"
                : "DELIVERY_STATUS_UNAVAILABLE",
        message:
          status === 401
            ? "This report access link is invalid or has expired."
            : status === 413
              ? "The request is too large."
              : status === 400
                ? "Submit one valid status request."
                : "Report delivery status is unavailable. Try again shortly.",
      },
      status,
      correlationId,
      { "Cache-Control": "no-store" },
    );
  }
}

export const POST = createPublicRateLimitedHandler(
  "report_delivery_status",
  handlePublicReportDeliveryStatus,
);

export const runtime = "nodejs";
