import { DataAccessInspector } from "./data-access-inspector";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#171918] px-4 py-8 text-[#f6f4ee] sm:px-6 sm:py-14">
      <div className="mx-auto w-full max-w-7xl">
        <section
          className="border-t border-white/10 pt-10 sm:pt-12"
          aria-labelledby="home-heading"
        >
          <div className="grid items-center gap-10 lg:grid-cols-[0.88fr_1.12fr] lg:gap-16">
            <div className="max-w-xl">
              <p className="text-sm font-semibold tracking-[0.02em] text-[#8e99a2]">
                Plan with confidence before you commit
              </p>
              <h1
                id="home-heading"
                className="mt-5 max-w-lg text-4xl leading-[1.02] font-semibold tracking-[-0.045em] text-[#f8f7f2] sm:text-6xl"
              >
                Find the right pool solution for your property
              </h1>
              <p className="mt-6 max-w-lg text-base leading-7 text-[#a8adb0] sm:text-lg sm:leading-8">
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
                    className="rounded-full bg-[#0d304b] px-3 py-1.5 text-sm font-semibold text-[#69b8ff]"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <div
              className="relative min-h-[330px] overflow-hidden rounded-[1.6rem] bg-[#2b2d2c] shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] sm:min-h-[390px]"
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
              <div className="absolute right-5 bottom-5 left-5 rounded-2xl border border-white/10 bg-[#383a39]/95 p-4 shadow-lg backdrop-blur-md sm:bottom-5 sm:left-auto sm:w-[min(80%,_300px)] sm:p-5">
                <p className="text-base leading-6 font-bold text-[#faf9f5]">
                  From backyard idea to buildable plan
                </p>
                <p className="mt-1 text-sm leading-5 text-[#d0d1cd]">
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
          className="mt-16 border-t border-white/10 pt-10 sm:mt-20 sm:pt-12"
          aria-labelledby="property-search-heading"
        >
          <div className="mb-6 max-w-2xl">
            <p className="text-sm font-semibold tracking-[0.02em] text-[#8e99a2]">
              Start with your property address
            </p>
            <h2
              id="property-search-heading"
              className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#f8f7f2] sm:text-3xl"
            >
              See what the site can support
            </h2>
            <p className="mt-3 hidden text-base leading-7 text-[#a8adb0]">
              We’ll find the address, open the mapped property view, and show
              what needs a closer look before you plan a pool.
            </p>
            <p className="mt-3 text-base leading-7 text-[#a8adb0]">
              We&apos;ll find the address, open the mapped property view, and
              show what needs a closer look before you plan a pool.
            </p>
          </div>
          <DataAccessInspector />
        </section>

        <footer className="mt-10 border-t border-white/10 pt-6 text-sm leading-6 text-[#8e99a2]">
          Preliminary desktop data inspection only. This tool does not determine
          pool feasibility, construction safety, consent requirements, title
          interests, easements, or exact underground service positions.
        </footer>
      </div>
    </main>
  );
}
