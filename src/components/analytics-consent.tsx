"use client";

import Script from "next/script";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ANALYTICS_CONSENT_STORAGE_KEY } from "@/modules/anonymous-funnel-analytics";

type ConsentChoice = "granted" | "denied" | null;
type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...arguments_: unknown[]) => void;
  [key: `ga-disable-${string}`]: boolean | undefined;
};

const CONSENT_CHANGE_EVENT = "rg-analytics-consent-change";

export function AnalyticsConsent({
  measurementId,
}: {
  measurementId?: string;
}) {
  const safeMeasurementId = isMeasurementId(measurementId)
    ? measurementId
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
    if (choice === "denied" && safeMeasurementId) {
      disableAnalytics(safeMeasurementId);
    }
  }, [choice, safeMeasurementId]);

  function choose(nextChoice: Exclude<ConsentChoice, null>) {
    try {
      localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, nextChoice);
    } catch {
      // An unavailable storage API must leave analytics disabled.
      if (nextChoice === "granted") return;
    }

    window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
    setSettingsOverride(false);
    if (!safeMeasurementId) return;

    if (nextChoice === "denied") {
      disableAnalytics(safeMeasurementId);
    } else {
      (window as unknown as AnalyticsWindow)[
        `ga-disable-${safeMeasurementId}`
      ] = false;
    }
  }

  const analyticsEnabled =
    choice === "granted" && safeMeasurementId !== undefined;

  return (
    <>
      {analyticsEnabled && (
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

      <div className="fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:right-6 sm:left-auto sm:w-96">
        {settingsOpen && (
          <section
            aria-labelledby="analytics-consent-heading"
            className="w-full rounded-2xl border border-slate-300 bg-white p-5 text-slate-800"
          >
            <h2
              id="analytics-consent-heading"
              className="text-base font-semibold text-slate-950"
            >
              Analytics cookies
            </h2>
            <p className="mt-2 text-sm leading-6">
              With your permission, GA4 records anonymous steps through the
              Property Check. We never send your contact details, property
              address, map, report, coordinates, or free text.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => choose("granted")}
                className="min-h-11 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                Allow analytics
              </button>
              <button
                type="button"
                onClick={() => choose("denied")}
                className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold transition-colors hover:border-teal-700 hover:text-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                {choice === "granted"
                  ? "Turn analytics off"
                  : "Reject analytics"}
              </button>
              <button
                type="button"
                onClick={() => setSettingsOverride(false)}
                className="min-h-11 px-3 text-sm font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
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
          className="min-h-11 rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:border-teal-700 hover:text-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
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
