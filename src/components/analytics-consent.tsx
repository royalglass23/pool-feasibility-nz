"use client";

import Script from "next/script";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ANALYTICS_CONSENT_STORAGE_KEY } from "@/modules/anonymous-funnel-analytics";
import { prepareSpeedInsightsEvent } from "@/modules/speed-insights";

type ConsentChoice = "granted" | "denied" | null;
type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...arguments_: unknown[]) => void;
  hj?: (...arguments_: unknown[]) => void;
  posthog?: {
    opt_in_capturing: () => void;
    opt_out_capturing: () => void;
  };
  [key: `ga-disable-${string}`]: boolean | undefined;
};

const CONSENT_CHANGE_EVENT = "rg-analytics-consent-change";
const POSTHOG_PROJECT_KEY = "phc_BCgxNofbcnuCzPePiYFdqzHKRaB6ectcYCRXJzjhDUPd";

export function AnalyticsConsent({
  measurementId,
  hotjarSiteId,
}: {
  measurementId?: string;
  hotjarSiteId?: string;
}) {
  const safeMeasurementId = isMeasurementId(measurementId)
    ? measurementId
    : undefined;
  const safeHotjarSiteId = isHotjarSiteId(hotjarSiteId)
    ? hotjarSiteId
    : undefined;
  const choice = useSyncExternalStore(
    subscribeToConsent,
    readStoredChoice,
    serverConsentChoice,
  );
  const [settingsOverride, setSettingsOverride] = useState<boolean | null>(
    null,
  );
  const settingsOpen = settingsOverride ?? choice === null;

  useEffect(() => {
    if (choice === "denied") {
      if (safeMeasurementId) disableAnalytics(safeMeasurementId);
      if (safeHotjarSiteId) disableHotjar(safeHotjarSiteId);
      (window as unknown as AnalyticsWindow).posthog?.opt_out_capturing();
    } else if (choice === "granted") {
      (window as unknown as AnalyticsWindow).posthog?.opt_in_capturing();
    }
  }, [choice, safeHotjarSiteId, safeMeasurementId]);

  function choose(nextChoice: Exclude<ConsentChoice, null>) {
    try {
      localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, nextChoice);
    } catch {
      // An unavailable storage API must leave analytics disabled.
      if (nextChoice === "granted") return;
    }

    window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
    setSettingsOverride(false);
    if (nextChoice === "denied") {
      if (safeMeasurementId) disableAnalytics(safeMeasurementId);
      if (safeHotjarSiteId) disableHotjar(safeHotjarSiteId);
      (window as unknown as AnalyticsWindow).posthog?.opt_out_capturing();
    } else {
      (window as unknown as AnalyticsWindow).posthog?.opt_in_capturing();
      if (safeMeasurementId) {
        (window as unknown as AnalyticsWindow)[
          `ga-disable-${safeMeasurementId}`
        ] = false;
      }
    }
  }

  const analyticsEnabled =
    choice === "granted" &&
    (safeMeasurementId !== undefined || safeHotjarSiteId !== undefined);

  return (
    <>
      {choice === "granted" && (
        <SpeedInsights beforeSend={prepareSpeedInsightsEvent} debug={false} />
      )}
      {choice === "granted" && (
        // Keep this pixel direct so the visitor's browser contacts Metricool.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="https://tracker.metricool.com/c3po.jpg?hash=ee5fad286a62e86c7cd7a56f6bc542ae"
          width={1}
          height={1}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute"
          referrerPolicy="no-referrer"
        />
      )}
      {analyticsEnabled && (
        <>
          {safeMeasurementId && (
            <>
              <Script
                id="ga4-loader"
                src={`https://www.googletagmanager.com/gtag/js?id=${safeMeasurementId}`}
                strategy="afterInteractive"
              />
              <Script
                id="ga4-config"
                strategy="afterInteractive"
                dangerouslySetInnerHTML={{
                  __html: ga4Configuration(safeMeasurementId),
                }}
              />
            </>
          )}
          {safeHotjarSiteId && (
            <Script
              id="hotjar-loader"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: hotjarConfiguration(safeHotjarSiteId),
              }}
            />
          )}
        </>
      )}
      {choice === "granted" && (
        <Script
          id="posthog-loader"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: posthogConfiguration() }}
        />
      )}

      <div className="fixed inset-x-4 bottom-4 z-50 flex max-h-[calc(100dvh-2rem)] flex-col items-end gap-2 sm:right-6 sm:left-auto sm:w-96">
        {settingsOpen && (
          <section
            aria-labelledby="analytics-consent-heading"
            className="border-pool-300 text-pool-800 w-full overflow-y-auto rounded-2xl border bg-white p-4 sm:p-5"
          >
            <h2
              id="analytics-consent-heading"
              className="text-pool-950 text-base font-semibold"
            >
              Analytics cookies
            </h2>
            <p className="mt-2 text-sm leading-6">
              Help us improve the Property Check with anonymous interaction and
              performance analytics. We never send your contact details,
              property address, map, report, coordinates, or free text.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => choose("granted")}
                className="bg-pool-950 hover:bg-pool-blue-800 focus-visible:outline-pool-blue-700 min-h-11 rounded-xl px-4 text-sm font-semibold text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Allow analytics
              </button>
              <button
                type="button"
                onClick={() => choose("denied")}
                className="border-pool-300 hover:border-pool-blue-700 hover:text-pool-blue-900 focus-visible:outline-pool-blue-700 min-h-11 rounded-xl border px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {choice === "granted"
                  ? "Turn analytics off"
                  : "Reject analytics"}
              </button>
              <button
                type="button"
                onClick={() => setSettingsOverride(false)}
                className="focus-visible:outline-pool-blue-700 min-h-11 px-3 text-sm font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Not now
              </button>
            </div>
          </section>
        )}
        <button
          type="button"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOverride(!settingsOpen)}
          className="border-pool-300 text-pool-800 hover:border-pool-blue-700 hover:text-pool-blue-900 focus-visible:outline-pool-blue-700 min-h-11 rounded-sm border bg-white px-4 text-sm font-semibold shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Analytics settings
        </button>
      </div>
    </>
  );
}

function readStoredChoice(): ConsentChoice {
  try {
    const value = localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

function serverConsentChoice(): ConsentChoice {
  return null;
}

function subscribeToConsent(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(CONSENT_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(CONSENT_CHANGE_EVENT, onStoreChange);
  };
}

function isMeasurementId(value: string | undefined): value is string {
  return typeof value === "string" && /^G-[A-Z0-9]+$/i.test(value);
}

function isHotjarSiteId(value: string | undefined): value is string {
  return typeof value === "string" && /^\d+$/.test(value);
}

function ga4Configuration(measurementId: string): string {
  const id = JSON.stringify(measurementId);
  return `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config',${id},{send_page_view:false,anonymize_ip:true,allow_google_signals:false,allow_ad_personalization_signals:false});`;
}

function disableAnalytics(measurementId: string) {
  const analyticsWindow = window as unknown as AnalyticsWindow;
  analyticsWindow[`ga-disable-${measurementId}`] = true;
  analyticsWindow.gtag?.("consent", "update", {
    analytics_storage: "denied",
  });

  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=", 1)[0]?.trim();
    if (name === "_ga" || name?.startsWith("_ga_")) {
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
    }
  }
}

function hotjarConfiguration(siteId: string) {
  const id = JSON.stringify(siteId);
  return `window.hj=window.hj||function(){(window.hj.q=window.hj.q||[]).push(arguments);};window._hjSettings={hjid:${id},hjsv:6};(function(){var script=document.createElement('script');script.async=true;script.src='https://static.hotjar.com/c/hotjar-'+window._hjSettings.hjid+'.js?sv='+window._hjSettings.hjsv;document.head.appendChild(script);})();`;
}

function posthogConfiguration(): string {
  return `!function(t,e){var o,n,p,r;e.__SV||(window.posthog&&window.posthog.__loaded)||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}p||((p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",p.onerror=function(){p=null},(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r));var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],Object.defineProperty(u,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e}}),Object.defineProperty(u.people,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(){return u.toString(1)+".people (stub)"}}),o="capture init opt_in_capturing opt_out_capturing".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
posthog.init(${JSON.stringify(POSTHOG_PROJECT_KEY)}, {
  api_host: "https://eu.i.posthog.com",
  defaults: "2026-05-30",
  person_profiles: "identified_only",
  autocapture: false,
  capture_pageview: false,
  capture_pageleave: false,
  capture_dead_clicks: false,
  capture_exceptions: false,
  capture_heatmaps: false,
  capture_performance: false,
  rageclick: false,
  disable_session_recording: true,
  disable_surveys: true,
  disable_persistence: true,
  opt_out_capturing_by_default: true,
  loaded: function(instance) {
    try {
      if (localStorage.getItem(${JSON.stringify(ANALYTICS_CONSENT_STORAGE_KEY)}) === "granted") instance.opt_in_capturing();
    } catch (_) {}
  },
  before_send: function(event) {
    try {
      if (localStorage.getItem(${JSON.stringify(ANALYTICS_CONSENT_STORAGE_KEY)}) !== "granted") return null;
    } catch (_) { return null; }
    var names = ["address_search_started", "property_check_completed", "report_form_viewed", "report_request_submitted", "report_delivery_outcome"];
    if (names.indexOf(event.event) === -1) return null;
    if (!event.properties || !event.properties.token || !event.properties.distinct_id) return null;
    var properties = { token: event.properties.token, distinct_id: event.properties.distinct_id };
    if (event.event === "report_delivery_outcome") {
      var outcome = event.properties && event.properties.outcome_category;
      if (["delivered", "partial", "failed"].indexOf(outcome) === -1) return null;
      properties.outcome_category = outcome;
    }
    event.properties = properties;
    return event;
  }
});`;
}

function disableHotjar(siteId: string) {
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=", 1)[0]?.trim();
    if (name?.startsWith("_hj")) {
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
    }
  }

  for (const storage of [localStorage, sessionStorage]) {
    try {
      for (const key of Object.keys(storage)) {
        if (key.startsWith("_hj") || key.startsWith("hj")) {
          storage.removeItem(key);
        }
      }
    } catch {
      // An unavailable storage API must not block withdrawal of consent.
    }
  }

  document
    .querySelectorAll(`script[src*="hotjar-${siteId}.js"]`)
    .forEach((script) => script.remove());
}
