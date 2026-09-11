import type { ClientApiError } from "@/shared/http/client-api-error";
import { withErrorReference } from "@/shared/http/client-api-error";

export function aerialTileRateLimitMessage(
  error: ClientApiError | null,
): string | null {
  if (error?.code === "RATE_LIMITED")
    return withErrorReference(
      "Aerial photo requests have reached their temporary limit. You can still review the property boundary; please wait before trying again.",
      error,
    );
  if (error?.code === "RATE_LIMIT_UNAVAILABLE")
    return withErrorReference(
      "Aerial photo requests are paused because the request limit service is unavailable. You can still review the property boundary; please try again shortly.",
      error,
    );
  return null;
}
