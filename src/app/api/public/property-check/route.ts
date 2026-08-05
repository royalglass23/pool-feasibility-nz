import "server-only";

import { POST as handlePropertyCheck } from "@/modules/data-access-spike/handle-fast-property-view-request";
import { createPublicRateLimitedHandler } from "@/modules/rate-limit/public-rate-limit";

export const POST = createPublicRateLimitedHandler(
  "property_check",
  handlePropertyCheck,
);

export const runtime = "nodejs";
