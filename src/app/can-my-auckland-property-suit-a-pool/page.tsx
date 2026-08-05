import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Can my Auckland property suit a pool? | Pool Planning Auckland",
  description:
    "Understand the early property questions worth checking before you plan a pool in Auckland.",
};

export default function PropertySuitabilityPage() {
  return (
    <main className="min-h-screen bg-[#f4f8f6] px-4 py-12 text-[#18322f] sm:px-6 sm:py-20">
      <article className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold text-[#0f6258]">Auckland pool planning</p>
        <h1 className="mt-4 text-balance text-4xl leading-tight font-semibold tracking-[-0.035em] sm:text-5xl">
          Can my Auckland property suit a pool?
        </h1>
        <p className="mt-6 max-w-2xl text-pretty text-lg leading-8 text-[#526761]">
          A pool project starts with more than a backyard measurement. A useful
          first look brings the property, access, practical layout, and local
          planning context into the same conversation.
        </p>
        <div className="mt-12 space-y-8 border-y border-[#cbdad5] py-8">
          <Section title="Start with usable space">
            Try an indicative pool layout against the mapped property. The
            layout is yours to move and rotate; it is not a final placement or
            a design recommendation.
          </Section>
          <Section title="Look beyond the pool shell">
            Access for people and machinery, slope, ground conditions, drainage,
            fencing, surrounds, and service locations can all affect what needs
            investigation before a project progresses.
          </Section>
          <Section title="Treat missing information honestly">
            An unavailable layer or early map result is not proof that a risk
            does not exist. Keep `Needs Checking` items visible and confirm them
            with the right on-site or professional advice.
          </Section>
        </div>
        <Link href="/#property-search" className="mt-10 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#18322f] px-5 font-semibold text-white transition hover:bg-[#0f6258] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700">
          Check my property <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </article>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h2 className="text-xl font-semibold tracking-[-0.02em]">{title}</h2><p className="mt-2 max-w-2xl text-pretty leading-7 text-[#526761]">{children}</p></section>;
}
