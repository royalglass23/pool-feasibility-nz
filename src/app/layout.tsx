import type { Metadata } from "next";
import Link from "next/link";
import { AnalyticsConsent } from "@/components/analytics-consent";
import { PoolReadyLogo } from "@/components/pool-ready-logo";
import { isSiteIndexingEnabled } from "@/config/site-indexing";
import { env } from "@/env";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";

const siteIndexingEnabled = isSiteIndexingEnabled();

export const metadata: Metadata = {
  title: "Pool Planning Auckland | Check your property",
  description:
    "Get an early view of your Auckland property's pool-planning context before you take the next step.",
  robots: siteIndexingEnabled
    ? { index: true, follow: true }
    : { index: false, follow: false, noarchive: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-50 border-b border-pool-200/90 bg-white/90 px-4 backdrop-blur sm:px-6">
          <nav
            aria-label="Primary"
            className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-4"
          >
            <Link
              href="/"
              aria-label="PoolReady home"
              className="inline-flex min-h-11 items-center rounded-xl outline-offset-4 focus-visible:outline-2 focus-visible:outline-pool-blue-700"
            >
              <PoolReadyLogo />
            </Link>
          </nav>
        </header>
        {children}
        <AnalyticsConsent measurementId={env.NEXT_PUBLIC_GA4_MEASUREMENT_ID} />
      </body>
    </html>
  );
}
