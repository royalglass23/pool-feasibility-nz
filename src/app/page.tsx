import { DataAccessInspector } from "./data-access-inspector";

export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#d9faf3_0,_transparent_38%),linear-gradient(180deg,_#f8fafc_0%,_#eef2f6_100%)] px-4 py-10 sm:px-6 sm:py-16">
      <div className="mx-auto w-full max-w-7xl">
        <header className="mb-10 max-w-3xl sm:mb-14">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-teal-700/15 bg-white/80 px-3 py-1.5 text-xs font-bold tracking-[0.14em] text-teal-800 uppercase shadow-sm backdrop-blur">
            Pool feasibility NZ · Data access POC
          </div>
          <h1 className="text-4xl leading-tight font-semibold tracking-[-0.035em] text-slate-950 sm:text-6xl">
            Inspect official property data before assessing pool feasibility.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            Enter an Auckland address to resolve its LINZ address point, match
            the mapped legal parcel, and check the current official dataset
            catalogue.
          </p>
        </header>

        <DataAccessInspector />

        <footer className="mt-10 border-t border-slate-300/70 pt-6 text-sm leading-6 text-slate-500">
          Preliminary desktop data inspection only. This tool does not determine
          pool feasibility, construction safety, consent requirements, title
          interests, easements, or exact underground service positions.
        </footer>
      </div>
    </main>
  );
}
