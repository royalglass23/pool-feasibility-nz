import "server-only";

import { handleAddressSuggestionsRequest } from "@/modules/data-access-spike/handle-address-suggestions-request";
import { createPublicRateLimitedHandler } from "@/modules/rate-limit/public-rate-limit";

export const runtime = "nodejs";

export const POST = createPublicRateLimitedHandler(
  "address_suggestion",
  handleAddressSuggestionsRequest,
);
