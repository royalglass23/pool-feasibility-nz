import type { ClientApiError } from "@/shared/http/client-api-error";

export function aerialTileRateLimitMessage(
  error: ClientApiError | null,
): string | null {
  if (error?.code === "RATE_LIMITED")
    return "Aerial photo requests have reached their temporary limit. You can still review the property boundary; please wait before trying again.";
  if (error?.code === "RATE_LIMIT_UNAVAILABLE")
    return "Aerial photo requests are paused because the request limit service is unavailable. You can still review the property boundary; please try again shortly.";
  return null;
}
