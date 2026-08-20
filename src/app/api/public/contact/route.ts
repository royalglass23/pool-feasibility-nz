import "server-only";

import { handleContactRequest } from "@/modules/contact/contact-request";
import { createPublicRateLimitedHandler } from "@/modules/rate-limit/public-rate-limit";

export const POST = createPublicRateLimitedHandler(
  "contact_request",
  (request) => handleContactRequest(request),
);

export const runtime = "nodejs";
