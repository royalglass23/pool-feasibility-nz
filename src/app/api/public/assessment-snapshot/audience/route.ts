import "server-only";
import { handleReportAudienceRequest } from "@/modules/assessment/handle-report-audience-request";
import { createPublicRateLimitedHandler } from "@/modules/rate-limit/public-rate-limit";

export const POST = createPublicRateLimitedHandler(
  "site_answers",
  handleReportAudienceRequest,
);
export const runtime = "nodejs";
