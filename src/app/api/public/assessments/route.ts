import "server-only";

import { POST as handleAssessmentRequest } from "@/modules/assessment/handle-assessment-requests";
import { createPublicRateLimitedHandler } from "@/modules/rate-limit/public-rate-limit";

export const POST = createPublicRateLimitedHandler(
  "report_request",
  handleAssessmentRequest,
);

export const runtime = "nodejs";
