import "server-only";

import {
  apiErrorResponse,
  requestCorrelationId,
} from "@/shared/http/api-response";

export async function POST(request: Request): Promise<Response> {
  const correlationId = requestCorrelationId(request);
  return apiErrorResponse(
    {
      code: "PDF_REPORTS_DISABLED",
      message: "PDF downloads are temporarily unavailable.",
    },
    410,
    correlationId,
    { "Cache-Control": "no-store" },
  );
}

export const runtime = "nodejs";
