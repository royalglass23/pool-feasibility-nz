import "server-only";

import { z } from "zod";
import { getDb } from "@/db/client";
import { getSavedPreliminaryReportById } from "@/db/repositories/homeowner-assessment-repository";
import { createPublicRateLimitedHandler } from "@/modules/rate-limit/public-rate-limit";
import { preliminaryReportFilename } from "@/modules/reporting/preliminary-report";
import {
  generatePreliminaryReportPdf,
  ReportRendererBusyError,
  ReportRendererTimeoutError,
} from "@/modules/reporting/report-renderer";
import {
  SavedReportAccessTokenError,
  verifySavedReportAccessToken,
} from "@/modules/reporting/saved-report-access-token";
import {
  apiErrorResponse,
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

async function handlePublicSavedReportPdf(request: Request): Promise<Response> {
  const correlationId = requestCorrelationId(request);
  try {
    const bytes = await readRequestBytesWithinLimit(request, MAX_REQUEST_BYTES);
    const body = requestSchema.parse(
      JSON.parse(new TextDecoder().decode(bytes)),
    );
    const access = verifySavedReportAccessToken(body.accessToken);
    const report = await getSavedPreliminaryReportById(
      getDb(),
      access.assessmentId,
    );
    if (!report || report.reference !== access.reference) {
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

    const pdf = await generatePreliminaryReportPdf(report);
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${preliminaryReportFilename(report)}"`,
        "Content-Type": "application/pdf",
        "X-Content-Type-Options": "nosniff",
        "X-Correlation-Id": correlationId,
      },
    });
  } catch (error) {
    if (error instanceof SavedReportAccessTokenError) {
      return apiErrorResponse(
        {
          code: "REPORT_ACCESS_REQUIRED",
          message: "This report download link is invalid or has expired.",
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
    if (error instanceof ReportRendererBusyError) {
      return apiErrorResponse(
        {
          code: "REPORT_RENDERER_BUSY",
          message: "The PDF renderer is busy. Try again shortly.",
        },
        429,
        correlationId,
        { "Cache-Control": "no-store", "Retry-After": "2" },
      );
    }
    if (error instanceof ReportRendererTimeoutError) {
      return apiErrorResponse(
        {
          code: "REPORT_RENDERER_TIMEOUT",
          message: "The PDF renderer timed out. Try again shortly.",
        },
        504,
        correlationId,
        { "Cache-Control": "no-store" },
      );
    }
    const invalid = error instanceof SyntaxError || error instanceof z.ZodError;
    return apiErrorResponse(
      {
        code: invalid ? "INVALID_REQUEST" : "REPORT_GENERATION_FAILED",
        message: invalid
          ? "Submit one valid report download request."
          : "The PDF could not be generated. Try again shortly.",
      },
      invalid ? 400 : 502,
      correlationId,
      { "Cache-Control": "no-store" },
    );
  }
}

export const POST = createPublicRateLimitedHandler(
  "report_pdf",
  handlePublicSavedReportPdf,
);

export const runtime = "nodejs";
