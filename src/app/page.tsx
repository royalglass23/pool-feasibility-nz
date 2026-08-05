import Link from "next/link";
import { ArrowRight, MapPinned, ScanSearch, ShieldCheck } from "lucide-react";
import { AucklandPropertyJourney } from "@/components/auckland-property-journey";
import { DataAccessInspector } from "./data-access-inspector";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f4f8f6] px-4 py-5 text-[#18322f] sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-7xl">
        <AucklandPropertyJourney />
        <section
          className="hidden border-t border-[#d4e0dc] pt-10 sm:pt-12"
          aria-labelledby="home-heading"
        >
          <div className="grid items-center gap-10 lg:grid-cols-[0.88fr_1.12fr] lg:gap-16">
            <div className="max-w-xl">
              <p className="text-sm font-semibold tracking-[0.02em] text-[#5e716a]">
                Plan with confidence before you commit
              </p>
              <h1
                id="home-heading"
                className="mt-5 max-w-lg text-4xl leading-[1.02] font-semibold tracking-[-0.045em] text-[#18322f] sm:text-6xl"
              >
                Find the right pool solution for your property
              </h1>
              <p className="mt-6 max-w-lg text-base leading-7 text-[#526761] sm:text-lg sm:leading-8">
                Check your site, understand the likely budget, compare suitable
                pool options, and connect with the professionals needed to
                deliver the complete project.
              </p>
              <div
                className="mt-7 flex max-w-md flex-wrap gap-2.5"
                aria-label="What you can plan"
              >
                {[
                  "Site feasibility",
                  "Budget guidance",
                  "Trusted referrals",
                ].map((label) => (
                  <span
                    key={label}
                    className="rounded-full bg-[#dbeef0] px-3 py-1.5 text-sm font-semibold text-[#1c6178]"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <div
              className="relative min-h-[330px] overflow-hidden rounded-[1.6rem] bg-[#6f897f] shadow-[0_30px_80px_-40px_rgba(26,57,50,0.45)] sm:min-h-[390px]"
              role="img"
              aria-label="A property planning view showing a pool, garden, and buildable site area"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_20%,_rgba(137,185,200,0.3),_transparent_26%),linear-gradient(135deg,_rgba(105,157,173,0.2),_transparent_42%),linear-gradient(145deg,_#526b68_0%,_#78928a_40%,_#b1b39a_40%,_#8f8d78_100%)]" />
              <div className="absolute -top-24 -right-16 size-72 rounded-full border-[26px] border-[#c2d7d0]/25 sm:size-96" />
              <div className="absolute inset-[12%_16%_18%_12%] rotate-[-8deg] rounded-[2rem] border-2 border-white/35 bg-[#9c9c82]/45 shadow-[0_20px_35px_-25px_rgba(0,0,0,0.8)]" />
              <div className="absolute top-[24%] left-[20%] h-[38%] w-[46%] rotate-[-8deg] rounded-[45%] border-[10px] border-[#d6e4de]/60 bg-[#2c95b7] shadow-[inset_0_0_0_4px_rgba(35,93,111,0.5),0_18px_30px_-20px_rgba(0,0,0,0.9)]">
                <div className="absolute inset-[14%] rounded-[45%] border border-white/35 bg-[linear-gradient(135deg,rgba(255,255,255,0.4),transparent_30%,rgba(13,80,116,0.22))]" />
              </div>
              <div className="absolute bottom-[18%] left-[12%] h-7 w-[24%] rotate-[-8deg] rounded-full bg-[#d5c8a9]/65" />
              <div
                className="absolute top-[16%] right-[10%] grid size-14 place-items-center rounded-full border border-white/30 bg-white/15 text-[0px] backdrop-blur-sm"
                aria-hidden="true"
              >
                ☼
              </div>
              <div className="absolute right-5 bottom-5 left-5 rounded-2xl border border-white/70 bg-[#f9fbf8]/95 p-4 shadow-lg backdrop-blur-md sm:bottom-5 sm:left-auto sm:w-[min(80%,_300px)] sm:p-5">
                <p className="text-base leading-6 font-bold text-[#18322f]">
                  From backyard idea to buildable plan
                </p>
                <p className="mt-1 text-sm leading-5 text-[#526761]">
                  Site checks, budget guidance and the right project team.
                </p>
              </div>
            </div>
          </div>
        </section>

        <header className="mb-10 hidden max-w-3xl sm:mb-14">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-teal-700/15 bg-white/80 px-3 py-1.5 text-xs font-bold tracking-[0.14em] text-teal-800 uppercase shadow-sm backdrop-blur">
            Pool feasibility NZ · Data access POC
          </div>
          <h1 className="text-4xl leading-tight font-semibold tracking-[-0.035em] text-slate-950 sm:text-6xl">
            Inspect official property data before assessing pool feasibility.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            Enter a New Zealand address to resolve its LINZ address point, match
            the mapped property boundary, and check the current official dataset
            catalogue.
          </p>
        </header>

        <section
          id="property-search"
          className="mt-16 scroll-mt-24 border-t border-[#d4e0dc] pt-10 sm:mt-20 sm:pt-12"
          aria-labelledby="property-search-heading"
        >
          <div className="mb-6 max-w-2xl">
            <p className="text-sm font-semibold tracking-[0.02em] text-[#5e716a]">
              Start with your Auckland property
            </p>
            <h2
              id="property-search-heading"
              className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#18322f] sm:text-3xl"
            >
              Begin with a practical property check
            </h2>
            <p className="mt-3 hidden text-base leading-7 text-[#526761]">
              We’ll find the address, open the mapped property view, and show
              what needs a closer look before you plan a pool.
            </p>
            <p className="mt-3 text-base leading-7 text-[#526761]">
              Search the property, try a pool layout, and see the early signals
              that deserve a closer look. You can request the detailed report
              once you are ready.
            </p>
          </div>
          <DataAccessInspector />
        </section>

        <section
          id="how-it-works"
          className="grid gap-10 border-t border-[#d4e0dc] py-14 sm:py-20 lg:grid-cols-[0.78fr_1.22fr] lg:gap-20"
          aria-labelledby="how-it-works-heading"
        >
          <div>
            <h2
              id="how-it-works-heading"
              className="max-w-sm text-balance text-3xl leading-tight font-semibold tracking-[-0.03em] text-[#18322f] sm:text-4xl"
            >
              The useful questions, before the expensive decisions.
            </h2>
            <p className="mt-5 max-w-md text-pretty text-base leading-7 text-[#526761]">
              This is a first look, not a final answer. It helps bring better
              questions to the people who will later design, quote, inspect, or
              approve the work.
            </p>
            <Link
              href="/can-my-auckland-property-suit-a-pool"
              className="mt-7 inline-flex min-h-11 items-center gap-2 font-semibold text-[#0f6258] underline decoration-[#8ebdaf] underline-offset-4 transition hover:text-[#18322f] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700"
            >
              Explore property-planning guidance
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <div className="border-t border-[#cbdad5] lg:border-t-0 lg:border-l lg:pl-10">
            <div className="grid divide-y divide-[#cbdad5]">
              <Feature
                icon={<MapPinned aria-hidden="true" className="size-5" />}
                title="Start with the site"
                text="Use the property map to explore an indicative pool layout. You can move and rotate it; the tool does not silently choose a location for you."
              />
              <Feature
                icon={<ScanSearch aria-hidden="true" className="size-5" />}
                title="Make uncertainty visible"
                text="Space, access, mapped evidence, and any missing information remain clear, so incomplete data is never treated as a green light."
              />
              <Feature
                icon={<ShieldCheck aria-hidden="true" className="size-5" />}
                title="Take a better next step"
                text="Save the detailed preliminary report when you are ready to carry the right questions into a builder, designer, engineer, or Council conversation."
              />
            </div>
          </div>
        </section>

        <section className="border-t border-[#d4e0dc] py-12 sm:py-16" aria-labelledby="builder-heading">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <h2 id="builder-heading" className="text-balance text-2xl font-semibold tracking-[-0.025em] text-[#18322f] sm:text-3xl">
                For Auckland pool builders: start the conversation with the property.
              </h2>
              <p className="mt-3 text-pretty text-base leading-7 text-[#526761]">
                Use the same early map and planning context to explain what a
                homeowner should check next. The tool is public guidance, not a
                partner programme or a lead-sharing service.
              </p>
            </div>
            <Link
              href="/auckland-pool-planning-for-builders"
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-[#a9c6bb] bg-transparent px-4 text-sm font-semibold text-[#18322f] transition hover:border-[#0f6258] hover:bg-[#e4f0eb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              Read builder guidance
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </section>

        <footer className="mt-10 border-t border-[#d4e0dc] pt-6 text-sm leading-6 text-[#5e716a]">
          Preliminary property guidance only. This tool does not determine pool
          feasibility, construction safety, consent requirements, title
          interests, easements, or exact underground service positions.
        </footer>
      </div>
    </main>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="grid gap-4 py-6 first:pt-0 last:pb-0 sm:grid-cols-[2.25rem_1fr]">
      <div className="grid size-9 place-items-center rounded-lg bg-[#dcece5] text-[#0f6258]">
        {icon}
      </div>
      <div>
        <h3 className="text-lg font-semibold text-[#18322f]">{title}</h3>
        <p className="mt-2 max-w-2xl text-pretty leading-7 text-[#526761]">{text}</p>
      </div>
    </div>
  );
}
