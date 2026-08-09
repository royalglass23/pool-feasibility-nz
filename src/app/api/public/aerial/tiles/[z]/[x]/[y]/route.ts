import "server-only";

import { GET as handleAerialTile } from "@/modules/providers/linz/handle-aerial-tile-request";
import { createPublicRateLimitedHandler } from "@/modules/rate-limit/public-rate-limit";

export const GET = createPublicRateLimitedHandler(
  "aerial_tile",
  handleAerialTile,
);

export const runtime = "nodejs";
