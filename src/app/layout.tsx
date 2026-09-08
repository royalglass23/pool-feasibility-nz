import type { Metadata } from "next";
import Link from "next/link";
import { PoolReadyBrand } from "@/components/pool-ready-brand";
import { SiteFooter } from "@/components/site-footer";
import { isSiteIndexingEnabled } from "@/config/site-indexing";
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
        <header className="border-pool-200/90 sticky top-0 z-50 border-b bg-white/90 px-4 backdrop-blur sm:px-6">
          <nav
            aria-label="Primary"
            className="mx-auto flex min-h-16 w-full max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2"
          >
            <PoolReadyBrand />
            <div className="flex w-full items-center gap-1 text-xs sm:w-auto sm:gap-2 sm:text-sm">
              <Link href="/#property-search" className="site-menu-link">
                Check your property
              </Link>
              <Link href="/partners" className="site-menu-link">
                Partnership Program
              </Link>
            </div>
          </nav>
        </header>
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
