import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Auckland pool planning for builders | Pool Planning Auckland",
  description:
    "Use early property context to make clearer Auckland pool-planning conversations with homeowners.",
};

export default function BuilderGuidancePage() {
  return (
    <main className="min-h-screen bg-[#f4f8f6] px-4 py-12 text-[#18322f] sm:px-6 sm:py-20">
      <article className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold text-[#0f6258]">For Auckland pool builders</p>
        <h1 className="mt-4 text-balance text-4xl leading-tight font-semibold tracking-[-0.035em] sm:text-5xl">
          Start the pool conversation with the property.
        </h1>
        <p className="mt-6 max-w-2xl text-pretty text-lg leading-8 text-[#526761]">
          The public Property Check gives homeowners and builders the same
          starting point: an early mapped view that makes constraints, missing
          information, and next questions easier to explain.
        </p>
        <div className="mt-12 space-y-8 border-y border-[#cbdad5] py-8">
          <Section title="Frame the site conversation earlier">
            Use an indicative layout to discuss space, access, and what the
            homeowner hopes to achieve before treating it as a construction solution.
          </Section>
          <Section title="Keep the limits visible">
            Public mapped information can support early questions, but it does
            not replace a site visit, service location, design, engineering,
            consent advice, or written quotation.
          </Section>
          <Section title="Help homeowners ask better questions">
            A useful early conversation makes the next specialist step clearer
            without promising a particular build outcome or sharing leads.
          </Section>
        </div>
        <Link href="/#property-search" className="mt-10 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#18322f] px-5 font-semibold text-white transition hover:bg-[#0f6258] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700">
          Check a property <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </article>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h2 className="text-xl font-semibold tracking-[-0.02em]">{title}</h2><p className="mt-2 max-w-2xl text-pretty leading-7 text-[#526761]">{children}</p></section>;
}
