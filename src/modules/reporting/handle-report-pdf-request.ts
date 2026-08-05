import "server-only";
import pino from "pino";

import {
  generateSessionReportPdf,
  ReportRendererBusyError,
  ReportRendererTimeoutError,
} from "@/modules/reporting/report-renderer";
import {
  parseSessionReportRequest,
  SessionReportValidationError,
} from "@/modules/reporting/report-request";
import { sessionReportFilename } from "@/modules/reporting/session-report";
import {
  apiErrorResponse,
  requestCorrelationId,
} from "@/shared/http/api-response";
import {
  BodyLimitError,
  readRequestBytesWithinLimit,
} from "@/shared/http/provider-runtime";

const MAX_REQUEST_BYTES = 6_500_000;
const logger = pino({ base: undefined });

export async function handleReportPdfRequest(
  request: Request,
  principal: "anonymous_public" | "local_development" | "internal_staff",
): Promise<Response> {
  const correlationId = requestCorrelationId(request);
  return handleReportPdf(request, principal, correlationId);
}

async function handleReportPdf(
  request: Request,
  principal: string,
  correlationId: string,
): Promise<Response> {
  const startedAt = Date.now();
  const complete = (
    response: Response,
    outcome: "generated" | "rejected" | "failed",
    category: string,
  ) => {
    logger.info({
      event: "pdf_report_security",
      outcome,
      category,
      principal,
      status: response.status,
      correlationId,
      durationMs: Date.now() - startedAt,
    });
    return response;
  };

  try {
    const bytes = await readRequestBytesWithinLimit(request, MAX_REQUEST_BYTES);
    const input = parseSessionReportRequest(
      JSON.parse(new TextDecoder().decode(bytes)),
    );
    const pdf = await generateSessionReportPdf(input);
    return complete(
      new Response(new Uint8Array(pdf), {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "Content-Disposition": `attachment; filename="${sessionReportFilename(input.assessment)}"`,
          "Content-Type": "application/pdf",
          "X-Content-Type-Options": "nosniff",
          "X-Correlation-Id": correlationId,
        },
      }),
      "generated",
      "success",
    );
  } catch (error) {
    if (error instanceof BodyLimitError) {
      return complete(
        apiErrorResponse(
          {
            code: "REQUEST_TOO_LARGE",
            message: "The report request is too large.",
          },
          413,
          correlationId,
          { "Cache-Control": "no-store" },
        ),
        "rejected",
        "request_too_large",
      );
    }
    if (error instanceof ReportRendererBusyError) {
      return complete(
        apiErrorResponse(
          {
            code: "REPORT_RENDERER_BUSY",
            message: "The PDF renderer is busy. Try again shortly.",
          },
          429,
          correlationId,
          { "Cache-Control": "no-store", "Retry-After": "2" },
        ),
        "rejected",
        "renderer_busy",
      );
    }
    if (error instanceof ReportRendererTimeoutError) {
      return complete(
        apiErrorResponse(
          {
            code: "REPORT_RENDERER_TIMEOUT",
            message: "The PDF renderer timed out. Try again shortly.",
          },
          504,
          correlationId,
          { "Cache-Control": "no-store" },
        ),
        "failed",
        "renderer_timeout",
      );
    }
    const invalid =
      error instanceof SyntaxError ||
      error instanceof SessionReportValidationError;
    return complete(
      apiErrorResponse(
        {
          code: "REPORT_GENERATION_FAILED",
          message: invalid
            ? "The report data or map image is invalid."
            : "The PDF could not be generated. Your assessment remains available in this session.",
        },
        invalid ? 400 : 502,
        correlationId,
        { "Cache-Control": "no-store" },
      ),
      invalid ? "rejected" : "failed",
      invalid ? "invalid_request" : "renderer_failed",
    );
  }
}
