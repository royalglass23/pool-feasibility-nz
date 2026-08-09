import "server-only";

import { createPublicRateLimitedHandler } from "@/modules/rate-limit/public-rate-limit";
import { POST as handleAerialConflicts } from "@/modules/spatial/handle-aerial-conflicts-request";

export const POST = createPublicRateLimitedHandler(
  "aerial_conflict",
  handleAerialConflicts,
);

export const runtime = "nodejs";
