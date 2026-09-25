import "server-only";
import { z } from "zod";
import {
  attachReportAudience,
  AssessmentSnapshotValidationError,
  verifyAssessmentSnapshot,
} from "./assessment-snapshot";
import { reportAudienceSchema } from "./report-audience";
import { namedPoolLayoutSchema } from "./pool-layout-schema";
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
    reportAudience: reportAudienceSchema,
    poolLayout: namedPoolLayoutSchema,
  })
  .strict();

export async function handleReportAudienceRequest(
  request: Request,
): Promise<Response> {
  const correlationId = requestCorrelationId(request);
  try {
    const bytes = await readRequestBytesWithinLimit(request, 5_501_024);
    const parsed = requestSchema.parse(
      JSON.parse(new TextDecoder().decode(bytes)),
    );
    const snapshot = verifyAssessmentSnapshot(parsed.assessmentSnapshot);
    const assessmentSnapshot = attachReportAudience(
      snapshot,
      parsed.reportAudience,
      parsed.poolLayout,
    );
    return apiJsonResponse(
      { assessmentSnapshot, reportAudience: parsed.reportAudience },
      200,
      correlationId,
      { "Cache-Control": "no-store" },
    );
  } catch (error) {
    const tooLarge =
      error instanceof BodyLimitError && error.code === "BODY_TOO_LARGE";
    if (!(
      error instanceof SyntaxError ||
      error instanceof z.ZodError ||
      error instanceof AssessmentSnapshotValidationError ||
      error instanceof BodyLimitError
    )) {
      throw error;
    }
    return apiErrorResponse(
      {
        code: tooLarge ? "REQUEST_TOO_LARGE" : "INVALID_REPORT_AUDIENCE",
        message: tooLarge
          ? "The report audience request is too large."
          : "Choose who this property check is for and try again. If the property check expired, search for the address again.",
      },
      tooLarge ? 413 : 400,
      correlationId,
      { "Cache-Control": "no-store" },
    );
  }
}
