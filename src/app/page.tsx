import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AucklandPropertyJourney } from "@/components/auckland-property-journey";
import { PoolFeasibilityExplainer } from "@/components/pool-feasibility-explainer";
import { DataAccessInspector } from "./data-access-inspector";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f5faff] text-[#062f5d]">
      <AucklandPropertyJourney />
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        <header className="mb-10 hidden max-w-3xl sm:mb-14">
          <div className="border-pool-blue-700/15 text-pool-blue-800 mb-6 inline-flex items-center gap-2 rounded-full border bg-white/80 px-3 py-1.5 text-xs font-bold tracking-[0.14em] uppercase shadow-sm backdrop-blur">
            Pool Lab · Data access POC
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
          <h2 id="how-it-works-heading" className="sr-only">
            How Pool Lab works
          </h2>
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="mx-auto w-full max-w-[480px]">
              <PoolFeasibilityExplainer />
            </div>

            <ol className="border-t border-[#c6dce9]">
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
          <DataAccessInspector />
        </section>

        <section
          className="border-t border-[#dbe8f0] py-14 sm:py-20"
          aria-labelledby="project-context-heading"
        >
          <div className="grid items-end gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div className="max-w-xl">
              <h2
                id="project-context-heading"
                className="text-3xl leading-tight font-semibold tracking-[-0.03em] text-balance text-[#062f5d] sm:text-4xl"
              >
                A pool project is more than the pool.
              </h2>
              <p className="mt-5 text-base leading-7 text-pretty text-[#426b87]">
                The best early decisions consider usable space, access, pool
                fencing, surrounding levels, and the details that make the
                finished area feel right at home.
              </p>
              <p className="mt-5 max-w-md text-sm leading-6 text-[#5c7e96]">
                Property Check helps you start that conversation with the site
                in view. It does not assess construction quality or approve a
                pool project.
              </p>
            </div>

            <figure className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-[#dbe8f0]">
              <Image
                src="/pool-projects/glass-pool-fence-courtyard.webp"
                alt="A pool courtyard with clear glass fencing, paved surrounds, and established planting"
                fill
                sizes="(max-width: 1023px) 100vw, 56vw"
                className="object-cover"
              />
              <figcaption className="absolute right-4 bottom-4 left-4 bg-[#062f5d]/90 px-4 py-3 text-sm leading-5 font-medium text-white backdrop-blur-sm sm:right-6 sm:bottom-6 sm:left-auto sm:max-w-xs">
                A good pool plan considers the experience around the water as
                well as the space it occupies.
              </figcaption>
            </figure>
          </div>
        </section>

        <section
          className="border-t border-[#dbe8f0] py-12 sm:py-16"
          aria-labelledby="builder-heading"
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <h2
                id="builder-heading"
                className="text-2xl font-semibold tracking-[-0.025em] text-balance text-[#062f5d] sm:text-3xl"
              >
                For Auckland pool builders: start the conversation with the
                property.
              </h2>
              <p className="mt-3 text-base leading-7 text-pretty text-[#426b87]">
                Use the same early map and planning context to explain what a
                homeowner should check next. The tool is public guidance, not a
                partner programme or a lead-sharing service.
              </p>
            </div>
            <Link
              href="/auckland-pool-planning-for-builders"
              className="focus-visible:outline-pool-blue-700 inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-[#9fc8df] bg-transparent px-4 text-sm font-semibold text-[#062f5d] transition hover:border-[#0077bd] hover:bg-[#e9f7ff] focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Read builder guidance
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </section>

        <footer className="mt-10 border-t border-[#dbe8f0] pt-6 text-sm leading-6 text-[#5c7e96]">
          Preliminary property guidance only. This tool does not determine pool
          feasibility, construction safety, consent requirements, title
          interests, easements, or exact underground service positions.
        </footer>
      </div>
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
      className={`grid gap-4 border-b border-[#c6dce9] py-8 sm:grid-cols-[3.5rem_minmax(0,1fr)] sm:gap-5 sm:py-10 ${
        isLast ? "border-b-0 pb-0" : ""
      }`}
    >
      <span
        aria-hidden="true"
        className="text-lg leading-7 font-semibold tracking-[-0.03em] text-[#0077bd]"
      >
        {number}
      </span>
      <div>
        <h3 className="text-xl leading-7 font-semibold text-balance text-[#062f5d]">
          {title}
        </h3>
        <p className="mt-2 max-w-xl leading-7 text-pretty text-[#426b87]">
          {text}
        </p>
      </div>
    </li>
  );
}
