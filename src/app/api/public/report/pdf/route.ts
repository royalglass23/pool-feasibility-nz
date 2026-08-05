import "server-only";

import { handleReportPdfRequest } from "@/modules/reporting/handle-report-pdf-request";

export async function POST(request: Request): Promise<Response> {
  return handleReportPdfRequest(request, "anonymous_public");
}

export const runtime = "nodejs";
