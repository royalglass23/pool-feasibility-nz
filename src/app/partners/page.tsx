import type { Metadata } from "next";
import Image from "next/image";
import { ContactEnquiryForm } from "@/components/contact-enquiry-form";

export const metadata: Metadata = {
  title: "Founding Partner Program | PoolReady",
  description:
    "Build PoolReady with us. An early access partnership for selected pool builders and pool professionals, powered by BlueHaven.",
};

const benefits = [
  [
    "Complimentary professional access",
    "Use PoolReady Professional and generate feasibility reports for your own clients during the early access period.",
  ],
  [
    "Priority access to suitable leads",
    "Receive priority consideration for genuine enquiries generated through PoolReady.",
  ],
  [
    "Early access to new tools",
    "Be among the first to trial estimating, proposals, concept design and project workflow tools.",
  ],
  [
    "Founding Partner product pricing",
    "Access exclusive introductory offers on selected premium pool products.",
  ],
  [
    "Preferred supplier pricing",
    "Benefit from improved pricing tiers and commercial terms as the supplier network grows.",
  ],
] as const;

export default function PartnersPage() {
  return (
    <main className="bg-[#f5faff] text-[#062f5d]">
      <section
        className="bg-[#0c2b43] text-white"
        aria-labelledby="partner-heading"
      >
        <div className="mx-auto grid max-w-7xl md:grid-cols-[1.15fr_1fr]">
          <div className="px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
            <h1
              id="partner-heading"
              className="max-w-xl text-4xl leading-[1.08] font-semibold tracking-[-0.03em] text-balance sm:text-5xl lg:text-6xl"
            >
              <span className="mb-5 block text-lg leading-7 tracking-normal text-[#94dff4]">
                Founding Partner Program
              </span>
              Build PoolReady with us.
            </h1>
            <p className="mt-6 max-w-md text-lg leading-8 text-[#d5e5ef]">
              An early access partnership for selected pool builders and pool
              professionals.
            </p>
            <a
              href="#partner-interest"
              className="mt-8 inline-flex min-h-12 items-center rounded-xl bg-[#e5f7fc] px-5 py-3 font-semibold text-[#062f5d] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#94dff4]"
            >
              Let&apos;s discuss the partnership
            </a>
            <p className="mt-6 text-sm leading-6 text-[#b8d4e4]">
              Professional access · Priority opportunities · Industry input
            </p>
          </div>
          <div className="relative min-h-64 overflow-hidden md:min-h-full">
            <Image
              src="/pool-projects/founding-partner-pool.jpg"
              alt="Pool and landscaped outdoor area"
              fill
              preload
              sizes="(min-width: 1280px) 595px, (min-width: 768px) 47vw, 100vw"
              className="origin-right scale-[1.35] object-cover"
            />
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <section className="border-b border-[#c6dce9] py-12 sm:py-16">
          <h2 className="max-w-2xl text-3xl leading-tight font-semibold tracking-[-0.03em] text-balance">
            A working partnership, built around real projects.
          </h2>
          <p className="mt-5 max-w-3xl leading-7 text-[#426b87]">
            Review a property, explore an indicative pool position, identify
            potential site constraints and prepare a preliminary report for the
            next client conversation.
          </p>
          <p className="mt-4 max-w-3xl leading-7 text-[#426b87]">
            Help shape a professional tool around the way pool businesses assess
            sites and guide customers before design, engineering or a quote.
          </p>
        </section>
        <section
          className="border-b border-[#c6dce9] py-12 sm:py-16"
          aria-labelledby="benefits-heading"
        >
          <h2
            id="benefits-heading"
            className="text-3xl leading-tight font-semibold tracking-[-0.03em]"
          >
            What Founding Partners receive
          </h2>
          <p className="mt-4 leading-7 text-[#426b87]">
            Value during early access, with advantages that grow as the network
            develops.
          </p>
          <dl className="mt-8 divide-y divide-[#c6dce9] border-t border-[#c6dce9]">
            {benefits.map(([title, detail]) => (
              <div
                key={title}
                className="grid gap-3 py-6 sm:grid-cols-[0.85fr_1.2fr] sm:gap-10"
              >
                <dt className="text-lg font-semibold">{title}</dt>
                <dd className="leading-7 text-[#426b87]">{detail}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="border-b border-[#c6dce9] py-12 sm:py-16">
          <h2 className="text-3xl leading-tight font-semibold tracking-[-0.03em]">
            What we ask in return
          </h2>
          <p className="mt-4 leading-7 text-[#426b87]">
            A genuine two-way partnership.
          </p>
          <div className="mt-8 grid gap-8 sm:grid-cols-2 sm:gap-12">
            <div>
              <h3 className="text-lg font-semibold">
                Practical feedback from real use
              </h3>
              <p className="mt-3 leading-7 text-[#426b87]">
                Use PoolReady on suitable projects and share clear suggestions
                so the platform reflects how pool professionals actually work.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold">
                Selected case studies, with approval
              </h3>
              <p className="mt-3 leading-7 text-[#426b87]">
                With prior approval, we may feature selected project photos,
                your company name and our collaboration experience. We will also
                look for opportunities to promote your business and completed
                work.
              </p>
            </div>
          </div>
          <p className="mt-6 text-sm leading-6 text-[#426b87]">
            Every use of project material remains subject to prior approval.
          </p>
        </section>
        <section
          id="partner-interest"
          className="grid scroll-mt-40 gap-8 py-12 sm:grid-cols-2 sm:gap-12 sm:py-16"
          aria-labelledby="interest-heading"
        >
          <div>
            <h2
              id="interest-heading"
              className="text-3xl leading-tight font-semibold tracking-[-0.03em] text-balance"
            >
              Let&apos;s discuss whether the partnership fits.
            </h2>
            <p className="mt-5 leading-7 text-[#426b87]">
              We are keeping the initial group small so we can work directly
              with each participating business and develop PoolReady together.
            </p>
            <p className="mt-4 leading-7 text-[#426b87]">
              Tell us about your business and your interest in becoming a
              Founding Partner.
            </p>
            <p className="mt-5 text-sm font-semibold text-[#426b87]">
              Limited Founding Partner places.
            </p>
          </div>
          <ContactEnquiryForm purpose="partnership" />
        </section>
      </div>
    </main>
  );
}
