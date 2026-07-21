import "server-only";

import {
  authorizeInternalRequest,
  internalAccessDeniedResponse,
} from "@/modules/internal-access/authorize-internal-request";
import {
  generateSessionReportPdf,
  parseSessionReportRequest,
  sessionReportFilename,
} from "@/modules/reporting/session-report";
import {
  apiErrorResponse,
  requestCorrelationId,
} from "@/shared/http/api-response";
import {
  BodyLimitError,
  readRequestBytesWithinLimit,
} from "@/shared/http/provider-runtime";

export const runtime = "nodejs";
const MAX_REQUEST_BYTES = 6_500_000;

export async function POST(request: Request): Promise<Response> {
  const correlationId = requestCorrelationId(request);
  const access = authorizeInternalRequest(request);
  if (!access.allowed)
    return internalAccessDeniedResponse(access, correlationId);

  try {
    const bytes = await readRequestBytesWithinLimit(request, MAX_REQUEST_BYTES);
    const input = parseSessionReportRequest(
      JSON.parse(new TextDecoder().decode(bytes)),
    );
    const pdf = await generateSessionReportPdf(input);
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${sessionReportFilename(input.assessment)}"`,
        "Content-Type": "application/pdf",
        "X-Content-Type-Options": "nosniff",
        "X-Correlation-Id": correlationId,
      },
    });
  } catch (error) {
    if (error instanceof BodyLimitError) {
      return apiErrorResponse(
        {
          code: "REQUEST_TOO_LARGE",
          message: "The report request is too large.",
        },
        413,
        correlationId,
        { "Cache-Control": "no-store" },
      );
    }
    const invalid =
      error instanceof SyntaxError ||
      (error instanceof Error && error.message.startsWith("INVALID_"));
    return apiErrorResponse(
      {
        code: "REPORT_GENERATION_FAILED",
        message: invalid
          ? "The report data or map image is invalid."
          : "The PDF could not be generated. Your assessment remains available in this session.",
      },
      invalid ? 400 : 502,
      correlationId,
      { "Cache-Control": "no-store" },
    );
  }
}
