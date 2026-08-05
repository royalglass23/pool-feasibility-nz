import { ArrowDownRight, MapPin, MoveDiagonal2, Search } from "lucide-react";

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
              className="mt-5 max-w-xl text-balance text-4xl leading-[1.04] font-semibold tracking-[-0.035em] sm:text-6xl"
            >
              A clearer first look at your property.
            </h1>
            <p className="mt-6 max-w-md text-pretty text-base leading-7 text-[#d2e3dc] sm:text-lg sm:leading-8">
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

        <div
          className="relative flex min-h-[410px] items-center justify-center overflow-hidden border-t border-white/10 bg-[#0f6258] p-5 lg:border-t-0 lg:border-l lg:p-10"
          role="img"
          aria-label="An animated property journey showing an address, an aerial property view, an adjustable pool concept, and clearer next steps."
        >
          <div className="relative aspect-[1.08] w-full max-w-[38rem] overflow-hidden rounded-2xl bg-[#c8d6bf] shadow-[0_18px_28px_-18px_rgba(0,0,0,0.45)]">
            <div className="absolute inset-0 bg-[linear-gradient(142deg,transparent_0_26%,rgba(255,255,255,0.55)_26%_29%,transparent_29%_51%,rgba(255,255,255,0.45)_51%_54%,transparent_54%)]" />
            <div className="absolute top-[10%] left-[12%] h-[21%] w-[25%] rotate-[-11deg] rounded-lg border border-[#799274]/60 bg-[#9ca995]" />
            <div className="absolute top-[16%] right-[12%] h-[23%] w-[26%] rotate-[9deg] rounded-lg border border-[#799274]/60 bg-[#aeb79a]" />
            <div className="absolute bottom-[10%] left-[11%] h-[29%] w-[28%] rotate-[5deg] rounded-lg border border-[#799274]/60 bg-[#aab292]" />
            <div className="absolute right-[12%] bottom-[14%] h-[25%] w-[33%] rotate-[-8deg] rounded-lg border border-[#799274]/60 bg-[#94a887]" />
            <div className="absolute top-[33%] left-[33%] h-[36%] w-[38%] rotate-[-7deg] rounded-[1.2rem] border-2 border-dashed border-[#176d62] bg-[#dce4ce]/75" />
            <div className="property-journey-marker absolute top-[24%] left-[29%] grid size-12 place-items-center rounded-full bg-[#18322f] text-white shadow-lg">
              <MapPin aria-hidden="true" className="size-6" />
            </div>
            <div className="property-journey-address absolute top-[11%] left-[10%] rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[#18322f] shadow-[0_8px_18px_-14px_rgba(0,0,0,0.6)]">
              42A Bahari Drive
            </div>
            <div className="property-journey-pool absolute top-[45%] left-[43%] h-[18%] w-[31%] rotate-[-7deg] rounded-[42%] border-[7px] border-[#f4f9f5] bg-[#1a96bd] shadow-[inset_0_0_0_3px_rgba(9,76,102,0.45),0_9px_16px_-10px_rgba(0,0,0,0.75)]" />
            <div className="property-journey-control absolute right-[12%] bottom-[11%] flex items-center gap-2 rounded-xl bg-[#18322f] px-3 py-2 text-sm font-semibold text-white shadow-lg">
              <MoveDiagonal2 aria-hidden="true" className="size-4" />
              Move &amp; rotate
            </div>
            <div className="property-journey-next absolute right-[7%] bottom-[7%] left-[7%] flex items-center justify-between gap-3 rounded-xl border border-white/60 bg-white/95 p-3 text-[#18322f] shadow-[0_8px_18px_-12px_rgba(0,0,0,0.45)] sm:p-4">
              <span>
                <span className="block text-sm font-semibold">Clearer next steps</span>
                <span className="mt-0.5 block text-xs text-[#526761]">
                  See what needs checking first
                </span>
              </span>
              <a
                href="#property-search"
                className="property-journey-cta inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#18322f] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#0f6258] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                <Search aria-hidden="true" className="size-3.5" />
                Check
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
