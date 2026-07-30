import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { ClipboardList, Waves } from "lucide-react";
import { isDevelopmentStaffAccessAllowed } from "@/modules/staff/development-staff-access";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pool Feasibility NZ | Property Data Inspector",
  description:
    "Inspect official Auckland address, parcel, and mapped dataset availability for preliminary pool-feasibility research.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {isDevelopmentStaffAccessAllowed() ? (
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
                Staff
              </Link>
            </nav>
          </header>
        ) : null}
        {children}
      </body>
    </html>
  );
}
