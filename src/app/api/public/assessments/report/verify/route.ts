import "server-only";

import pino from "pino";
import { z } from "zod";
import { getDb } from "@/db/client";
import { getAssessmentDeliveryStateById } from "@/db/repositories/homeowner-assessment-repository";
import { createPublicRateLimitedHandler } from "@/modules/rate-limit/public-rate-limit";
import { deliverAssessmentReportByReference } from "@/modules/reporting/deliver-assessment-report";
import {
  ReportRecipientVerificationTokenError,
  verifyReportRecipientVerificationToken,
} from "@/modules/reporting/report-recipient-verification-token";
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
  .object({ verificationToken: z.string().min(32).max(4_096) })
  .strict();
const logger = pino({ base: undefined });

async function handleReportRecipientVerification(
  request: Request,
): Promise<Response> {
  const correlationId = requestCorrelationId(request);
  try {
    const bytes = await readRequestBytesWithinLimit(request, MAX_REQUEST_BYTES);
    const body = requestSchema.parse(
      JSON.parse(new TextDecoder().decode(bytes)),
    );
    const access = verifyReportRecipientVerificationToken(
      body.verificationToken,
    );
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
    await deliverAssessmentReportByReference(access.reference);
    const delivery =
      (await getAssessmentDeliveryStateById(getDb(), access.assessmentId)) ??
      state;
    return apiJsonResponse(
      { delivery: delivery.delivery },
      200,
      correlationId,
      {
        "Cache-Control": "no-store",
      },
    );
  } catch (error) {
    if (error instanceof ReportRecipientVerificationTokenError) {
      return apiErrorResponse(
        {
          code: "REPORT_RECIPIENT_VERIFICATION_REQUIRED",
          message: "This email confirmation link is invalid or has expired.",
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
        event: "public_report_recipient_verification",
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
          ? "Submit one valid email confirmation."
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
  handleReportRecipientVerification,
);

export const runtime = "nodejs";
