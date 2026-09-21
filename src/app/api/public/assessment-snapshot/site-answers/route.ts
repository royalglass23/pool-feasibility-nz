import "server-only";
import { handleSiteAnswersRequest } from "@/modules/assessment/handle-site-answers-request";
import { createPublicRateLimitedHandler } from "@/modules/rate-limit/public-rate-limit";

export const POST = createPublicRateLimitedHandler(
  "site_answers",
  handleSiteAnswersRequest,
);
export const runtime = "nodejs";
