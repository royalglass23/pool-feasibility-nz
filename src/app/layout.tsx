import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Waves } from "lucide-react";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";

export const metadata: Metadata = {
  title: "Pool Planning Auckland | Check your property",
  description:
    "Get an early view of your Auckland property's pool-planning context before you take the next step.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-50 border-b border-slate-200/90 bg-white/90 px-4 backdrop-blur sm:px-6">
          <nav
            aria-label="Primary"
            className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-4"
          >
            <Link
              href="/"
              className="inline-flex min-h-11 items-center gap-2 rounded-full pr-3 text-sm font-semibold text-slate-950 outline-offset-4 focus-visible:outline-2 focus-visible:outline-teal-700"
            >
              <span className="grid size-9 place-items-center rounded-full bg-teal-800 text-white">
                <Waves aria-hidden="true" className="size-4" />
              </span>
              Pool Feasibility NZ
            </Link>
            <Link
              href="/staff"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm outline-offset-4 transition hover:border-teal-700/30 hover:bg-teal-50 hover:text-teal-900 focus-visible:outline-2 focus-visible:outline-teal-700"
            >
              <ClipboardList aria-hidden="true" className="size-4" />
              Staff sign in
            </Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
