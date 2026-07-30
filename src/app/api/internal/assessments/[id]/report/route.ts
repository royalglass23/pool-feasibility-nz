import "server-only";

import {
  authorizeInternalRequest,
  internalAccessDeniedResponse,
} from "@/modules/internal-access/authorize-internal-request";
import { getDb } from "@/db/client";
import { getSavedPreliminaryReportById } from "@/db/repositories/homeowner-assessment-repository";
import { generatePreliminaryReportPdf } from "@/modules/reporting/report-renderer";
import { preliminaryReportFilename } from "@/modules/reporting/preliminary-report";
import {
  apiErrorResponse,
  requestCorrelationId,
} from "@/shared/http/api-response";

export const runtime = "nodejs";
const ASSESSMENT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const correlationId = requestCorrelationId(request);
  const access = authorizeInternalRequest(request);
  if (!access.allowed) {
    return internalAccessDeniedResponse(access, correlationId);
  }
  const { id } = await context.params;
  if (!ASSESSMENT_ID_PATTERN.test(id)) {
    return apiErrorResponse(
      { code: "INVALID_REQUEST", message: "The report identifier is invalid." },
      400,
      correlationId,
      { "Cache-Control": "no-store" },
    );
  }
  const report = await getSavedPreliminaryReportById(getDb(), id);
  if (!report) {
    return apiErrorResponse(
      {
        code: "ASSESSMENT_NOT_FOUND",
        message: "The saved assessment report was not found.",
      },
      404,
      correlationId,
      { "Cache-Control": "no-store" },
    );
  }

  try {
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
  } catch {
    return apiErrorResponse(
      {
        code: "REPORT_GENERATION_FAILED",
        message:
          "The PDF could not be generated. Your saved assessment remains available.",
      },
      502,
      correlationId,
      { "Cache-Control": "no-store" },
    );
  }
}
