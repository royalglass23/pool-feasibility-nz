import Image from "next/image";
import { ArrowDownRight } from "lucide-react";

export function AucklandPropertyJourney() {
  return (
    <section
      className="relative isolate w-full overflow-hidden bg-[#dbe8f0]"
      aria-labelledby="home-heading"
    >
      <Image
        alt=""
        aria-hidden="true"
        className="object-cover object-[64%_center]"
        fill
        preload
        sizes="100vw"
        src="/pool-projects/pool-hero-aerial-v2.png"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(245,250,255,0.98)_0%,rgba(245,250,255,0.93)_43%,rgba(245,250,255,0.46)_72%,rgba(245,250,255,0.10)_100%)] lg:bg-[linear-gradient(90deg,rgba(245,250,255,1)_0%,rgba(245,250,255,0.97)_31%,rgba(245,250,255,0.71)_46%,rgba(245,250,255,0.12)_65%,transparent_78%)]"
      />
      <div className="xl:px-hero-inset relative z-10 px-6 sm:px-10 lg:px-16">
        <div className="flex min-h-[590px] max-w-xl flex-col justify-between py-8 sm:py-12 lg:min-h-[620px] lg:py-14">
          <div>
            <p className="max-w-md text-sm font-semibold text-[#426b87]">
              Auckland pool planning, before the big decisions
            </p>
            <h1
              id="home-heading"
              className="mt-5 max-w-xl text-4xl leading-[1.04] font-semibold tracking-[-0.035em] text-balance text-[#062f5d] sm:text-6xl"
            >
              A clearer first look at your property.
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-pretty text-[#426b87] sm:text-lg sm:leading-8">
              Search an Auckland address, place a pool concept on the map, and
              see what deserves a closer look before you plan further.
            </p>
          </div>

          <div className="mt-10">
            <a
              href="#property-search"
              className="inline-flex min-h-13 items-center gap-3 rounded-xl bg-[#062f5d] px-5 text-base font-semibold text-white transition-colors duration-200 ease-out hover:bg-[#0b477a] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#062f5d] active:bg-[#001f3d] motion-reduce:transition-none"
            >
              Check my property
              <ArrowDownRight aria-hidden="true" className="size-5" />
            </a>
            <p className="mt-4 max-w-sm text-sm leading-6 text-[#426b87]">
              Preliminary guidance only. It is not a building approval, survey,
              engineering assessment, or builder quote.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
