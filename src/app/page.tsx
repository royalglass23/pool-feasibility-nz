import { AucklandPropertyJourney } from "@/components/auckland-property-journey";
import { AnalyticsConsent } from "@/components/analytics-consent";
import { PoolFeasibilityExplainer } from "@/components/pool-feasibility-explainer";
import { PropertyCheckJourney } from "@/components/property-check-journey";
import { env } from "@/env";
import { ArrowDownRight } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f5faff] text-[#062f5d]">
      <AucklandPropertyJourney />
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        <section
          id="how-it-works"
          className="mt-14 border-t border-[#dbe8f0] py-10 sm:mt-16 sm:py-12"
          aria-labelledby="how-it-works-heading"
        >
          <div className="mx-auto max-w-6xl">
            <h2
              id="how-it-works-heading"
              className="text-2xl font-semibold tracking-[-0.03em] text-[#062f5d] sm:text-3xl"
            >
              How your property check works
            </h2>
            <p className="mt-2 max-w-xl text-base leading-7 text-pretty text-[#426b87] sm:text-lg">
              From your address to a clearer next step.
            </p>
          </div>

          <div className="mx-auto mt-8 max-w-6xl sm:mt-9">
            <PoolFeasibilityExplainer />
          </div>

          <div className="mt-6 flex justify-center sm:mt-8">
            <Link
              href="#property-search"
              className="inline-flex min-h-13 items-center gap-3 rounded-xl bg-[#062f5d] px-5 text-base font-semibold text-white transition-colors duration-200 ease-out hover:bg-[#0b477a] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#062f5d] active:bg-[#001f3d] motion-reduce:transition-none"
            >
              Check my property
              <ArrowDownRight aria-hidden="true" className="size-5" />
            </Link>
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
            <PropertyCheckJourney />
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
