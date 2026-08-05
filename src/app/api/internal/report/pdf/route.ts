import "server-only";

import pino from "pino";
import {
  authorizeInternalRequest,
  internalAccessDeniedResponse,
} from "@/modules/internal-access/authorize-internal-request";
import { handleReportPdfRequest } from "@/modules/reporting/handle-report-pdf-request";
import { requestCorrelationId } from "@/shared/http/api-response";

export const runtime = "nodejs";
const logger = pino({ base: undefined });

export async function POST(request: Request): Promise<Response> {
  const correlationId = requestCorrelationId(request);
  const principal =
    process.env.NODE_ENV === "development"
      ? "local_development"
      : "internal_staff";
  const access = authorizeInternalRequest(request);
  if (!access.allowed) {
    const response = internalAccessDeniedResponse(access, correlationId);
    logger.info({
      event: "pdf_report_security",
      outcome: "rejected",
      category:
        access.code === "UNAUTHORIZED"
          ? "unauthorized"
          : "access_misconfigured",
      principal,
      status: response.status,
      correlationId,
      durationMs: 0,
    });
    return response;
  }
  return handleReportPdfRequest(request, principal);
}
