import { AucklandPropertyJourney } from "@/components/auckland-property-journey";
import { AnalyticsConsent } from "@/components/analytics-consent";
import { PoolFeasibilityExplainer } from "@/components/pool-feasibility-explainer";
import { env } from "@/env";
import {
  FileCheck2,
  MapPinHouse,
  Move,
  ScanSearch,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { DataAccessInspector } from "./data-access-inspector";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f5faff] text-[#062f5d]">
      <AucklandPropertyJourney />
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        <header className="mb-10 hidden max-w-3xl sm:mb-14">
          <div className="border-pool-blue-700/15 text-pool-blue-800 mb-6 inline-flex items-center gap-2 rounded-sm border bg-white/80 px-3 py-1.5 text-xs font-bold tracking-[0.14em] uppercase shadow-sm backdrop-blur">
            PoolReady · Data access POC
          </div>
          <h1 className="text-pool-950 text-4xl leading-tight font-semibold tracking-[-0.035em] sm:text-6xl">
            Inspect official property data before assessing pool feasibility.
          </h1>
          <p className="text-pool-600 mt-5 max-w-2xl text-base leading-7 sm:text-lg sm:leading-8">
            Enter a New Zealand address to resolve its LINZ address point, match
            the mapped property boundary, and check the current official dataset
            catalogue.
          </p>
        </header>

        <section
          id="how-it-works"
          className="mt-16 border-t border-[#dbe8f0] py-14 sm:mt-20 sm:py-20"
          aria-labelledby="how-it-works-heading"
        >
          <div className="max-w-2xl">
            <h2
              id="how-it-works-heading"
              className="text-3xl leading-tight font-semibold tracking-[-0.03em] text-balance text-[#062f5d] sm:text-4xl"
            >
              How it works
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-pretty text-[#426b87] sm:text-lg sm:leading-8">
              Start with your address, try a pool position, check for potential
              constraints, and get your preliminary report.
            </p>
          </div>

          <div className="mt-10 grid items-stretch gap-12 lg:mt-12 lg:grid-cols-2 lg:gap-16">
            <div className="mx-auto w-full max-w-[480px]">
              <PoolFeasibilityExplainer />
            </div>

            <ol className="mx-auto flex w-full max-w-[480px] flex-col border-t border-[#c6dce9] lg:aspect-[480/445]">
              <ProcessStep
                icon={MapPinHouse}
                number="01"
                title="Find your property"
                text="Enter your Auckland address and select the matching property."
              />
              <ProcessStep
                icon={Move}
                number="02"
                title="Position your pool"
                text="Choose a pool size, drag the pool to move it, and drag the rotate handle to turn it."
              />
              <ProcessStep
                icon={ScanSearch}
                number="03"
                title="Check for constraints"
                text="Select “Check for constraints” to load available mapped information about potential site constraints."
              />
              <ProcessStep
                icon={FileCheck2}
                number="04"
                title="Get your preliminary report"
                text="Enter your details to get your report, understand what needs checking, and prepare for your next conversation."
                isLast
              />
            </ol>
          </div>
        </section>

        <section
          id="property-search"
          className="scroll-mt-40 border-t border-[#dbe8f0] pt-10 sm:pt-12"
          aria-label="Property check"
        >
          <div id="property-search-intro" className="mb-6 max-w-2xl">
            <p className="text-sm font-semibold tracking-[0.02em] text-[#5c7e96]">
              Start with your Auckland property
            </p>
            <h2
              id="property-search-heading"
              className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#062f5d] sm:text-3xl"
            >
              Check your property
            </h2>
            <p className="mt-3 text-base leading-7 text-[#426b87]">
              Enter the address of the property you want to check, then select
              the matching address.
            </p>
          </div>
          <div data-hj-suppress>
            <DataAccessInspector />
          </div>
        </section>

        <section
          className="border-t border-[#dbe8f0] py-14 sm:py-20"
          aria-labelledby="pool-builders-heading"
        >
          <div className="flex max-w-4xl flex-col gap-5 sm:gap-6">
            <div className="max-w-2xl">
              <h2
                id="pool-builders-heading"
                className="text-2xl font-semibold tracking-[-0.03em] text-[#062f5d] sm:text-3xl"
              >
                Start the site conversation with PoolReady
              </h2>
              <p className="mt-3 text-base leading-7 text-[#426b87]">
                Use the shared property view to discuss space, access, and the
                questions that still need checking before a site visit, design,
                or quote.
              </p>
            </div>
            <Link
              href="/auckland-pool-planning-for-builders"
              className="inline-flex min-h-11 w-fit items-center text-sm font-semibold text-[#006da9] underline decoration-[#85b8d4] underline-offset-4 transition-colors hover:text-[#062f5d] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0077bd]"
            >
              How PoolReady supports early builder conversations
            </Link>
          </div>
        </section>
      </div>
      <AnalyticsConsent
        measurementId={env.NEXT_PUBLIC_GA4_MEASUREMENT_ID}
        hotjarSiteId={env.NEXT_PUBLIC_HOTJAR_SITE_ID}
      />
    </main>
  );
}

function ProcessStep({
  icon: Icon,
  number,
  title,
  text,
  isLast = false,
}: {
  icon: LucideIcon;
  number: string;
  title: string;
  text: string;
  isLast?: boolean;
}) {
  return (
    <li
      className={`grid flex-1 grid-cols-[2rem_2.25rem_minmax(0,1fr)] items-start gap-3 border-b border-[#c6dce9] py-8 sm:grid-cols-[2rem_2.5rem_minmax(0,1fr)] sm:gap-4 sm:py-10 lg:gap-3 lg:py-3 ${
        isLast ? "border-b-0" : ""
      }`}
    >
      <span
        aria-hidden="true"
        className="flex h-9 items-center text-sm leading-5 font-semibold tracking-[-0.02em] text-[#0077bd]"
      >
        {number}
      </span>
      <Icon
        aria-hidden="true"
        strokeWidth={1.5}
        className="size-9 shrink-0 text-[#0077bd]"
      />
      <div>
        <h3 className="text-xl leading-7 font-semibold text-balance text-[#062f5d] lg:text-lg lg:leading-6">
          {title}
        </h3>
        <p className="mt-2 max-w-xl leading-7 text-pretty text-[#426b87] lg:mt-1 lg:text-sm lg:leading-5">
          {text}
        </p>
      </div>
    </li>
  );
}
