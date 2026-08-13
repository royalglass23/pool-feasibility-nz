import { ArrowDownRight } from "lucide-react";
import { PoolFeasibilityExplainer } from "@/components/pool-feasibility-explainer";

export function AucklandPropertyJourney() {
  return (
    <section
      className="overflow-hidden rounded-2xl bg-[#18322f] text-white shadow-[0_8px_8px_-6px_rgba(24,50,47,0.2)]"
      aria-labelledby="home-heading"
    >
      <div className="grid min-h-[620px] lg:grid-cols-[minmax(0,0.91fr)_minmax(31rem,1.09fr)]">
        <div className="flex flex-col justify-between px-6 py-8 sm:px-10 sm:py-12 lg:px-12 lg:py-14">
          <div>
            <p className="max-w-md text-sm font-semibold text-[#b9ddd0]">
              Auckland pool planning, before the big decisions
            </p>
            <h1
              id="home-heading"
              className="mt-5 max-w-xl text-4xl leading-[1.04] font-semibold tracking-[-0.035em] text-balance sm:text-6xl"
            >
              A clearer first look at your property.
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-pretty text-[#d2e3dc] sm:text-lg sm:leading-8">
              Search an Auckland address, place a pool concept on the map, and
              see what deserves a closer look before you plan further.
            </p>
          </div>

          <div className="mt-10">
            <a
              href="#property-search"
              className="inline-flex min-h-13 items-center gap-3 rounded-xl bg-[#d9f0e7] px-5 text-base font-semibold text-[#18322f] transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d9f0e7]"
            >
              Check my property
              <ArrowDownRight aria-hidden="true" className="size-5" />
            </a>
            <p className="mt-4 max-w-sm text-sm leading-6 text-[#b9ddd0]">
              Preliminary guidance only. It is not a building approval, survey,
              engineering assessment, or builder quote.
            </p>
          </div>
        </div>

        <div className="relative flex min-h-[410px] items-center justify-center overflow-hidden border-t border-white/10 bg-[#0f6258] p-5 lg:border-t-0 lg:border-l lg:p-10">
          <PoolFeasibilityExplainer />
        </div>
      </div>
    </section>
  );
}
