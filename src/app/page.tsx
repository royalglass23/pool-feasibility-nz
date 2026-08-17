import { AucklandPropertyJourney } from "@/components/auckland-property-journey";
import { AnalyticsConsent } from "@/components/analytics-consent";
import { PoolFeasibilityExplainer } from "@/components/pool-feasibility-explainer";
import { env } from "@/env";
import { DataAccessInspector } from "./data-access-inspector";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f5faff] text-[#062f5d]">
      <AucklandPropertyJourney />
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        <header className="mb-10 hidden max-w-3xl sm:mb-14">
          <div className="border-pool-blue-700/15 text-pool-blue-800 mb-6 inline-flex items-center gap-2 rounded-full border bg-white/80 px-3 py-1.5 text-xs font-bold tracking-[0.14em] uppercase shadow-sm backdrop-blur">
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
              A practical first look at the property, the pool idea, and the
              questions worth carrying forward.
            </p>
          </div>

          <div className="mt-10 grid items-stretch gap-12 lg:mt-12 lg:grid-cols-2 lg:gap-16">
            <div className="mx-auto w-full max-w-[480px]">
              <PoolFeasibilityExplainer />
            </div>

            <ol className="mx-auto flex w-full max-w-[480px] flex-col border-t border-[#c6dce9] lg:aspect-[480/445]">
              <ProcessStep
                number="01"
                title="Find the property"
                text="It gives everyone a shared place to start, with the site and its available evidence in view."
              />
              <ProcessStep
                number="02"
                title="Try a pool position"
                text="Select a pool size, move, and rotate an indicative pool on the map."
              />
              <ProcessStep
                number="03"
                title="See what needs checking"
                text="Site context and usable space stay visible rather than becoming a false green light."
              />
              <ProcessStep
                number="04"
                title="Get your preliminary report"
                text="When you are ready, request a detailed preliminary report to support the next conversation."
                isLast
              />
            </ol>
          </div>
        </section>

        <section
          id="property-search"
          className="scroll-mt-24 border-t border-[#dbe8f0] pt-10 sm:pt-12"
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
              Begin with a practical property check
            </h2>
            <p className="mt-3 text-base leading-7 text-[#426b87]">
              Search the property, try a pool layout, and see the early signals
              that deserve a closer look. You can request the detailed report
              once you are ready.
            </p>
          </div>
          <div data-hj-suppress>
            <DataAccessInspector />
          </div>
        </section>

        <footer className="mt-10 border-t border-[#dbe8f0] pt-6 text-sm leading-6 text-[#5c7e96]">
          Preliminary property guidance only. This tool does not determine pool
          feasibility, construction safety, consent requirements, title
          interests, easements, or exact underground service positions.
        </footer>
      </div>
      <AnalyticsConsent
        measurementId={env.NEXT_PUBLIC_GA4_MEASUREMENT_ID}
        hotjarSiteId={env.NEXT_PUBLIC_HOTJAR_SITE_ID}
      />
    </main>
  );
}

function ProcessStep({
  number,
  title,
  text,
  isLast = false,
}: {
  number: string;
  title: string;
  text: string;
  isLast?: boolean;
}) {
  return (
    <li
      className={`grid flex-1 gap-4 border-b border-[#c6dce9] py-8 sm:grid-cols-[3.5rem_minmax(0,1fr)] sm:gap-5 sm:py-10 lg:grid-cols-[3rem_minmax(0,1fr)] lg:gap-3 lg:py-3 ${
        isLast ? "border-b-0" : ""
      }`}
    >
      <span
        aria-hidden="true"
        className="text-lg leading-7 font-semibold tracking-[-0.03em] text-[#0077bd] lg:text-base lg:leading-6"
      >
        {number}
      </span>
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
