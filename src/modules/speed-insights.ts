import type { ComponentProps } from "react";
import type { SpeedInsights } from "@vercel/speed-insights/next";
import { ANALYTICS_CONSENT_STORAGE_KEY } from "@/modules/anonymous-funnel-analytics";

type SpeedInsightsEvent = Parameters<
  NonNullable<ComponentProps<typeof SpeedInsights>["beforeSend"]>
>[0];

export function prepareSpeedInsightsEvent(event: SpeedInsightsEvent) {
  try {
    // The injected script can outlive its React component. Check live consent
    // and location for every event, including after client-side navigation.
    if (
      localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY) !== "granted" ||
      window.location.pathname !== "/"
    ) {
      return null;
    }

    const url = new URL(event.url, window.location.origin);
    if (url.origin !== window.location.origin || url.pathname !== "/") {
      return null;
    }

    // Keep property searches, campaign parameters and fragments out of telemetry.
    return { ...event, url: `${url.origin}/` };
  } catch {
    return null;
  }
}
