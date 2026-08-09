import "server-only";

import { createPublicRateLimitedHandler } from "@/modules/rate-limit/public-rate-limit";
import { handleReportPdfRequest } from "@/modules/reporting/handle-report-pdf-request";

export const POST = createPublicRateLimitedHandler("report_pdf", (request) =>
  handleReportPdfRequest(request, "anonymous_public"),
);

export const runtime = "nodejs";
