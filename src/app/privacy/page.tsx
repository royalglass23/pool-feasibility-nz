import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy notice | Pool Lab",
  description:
    "How Royal Glass handles personal and property information submitted for a preliminary pool report.",
};

export default function PrivacyNoticePage() {
  return (
    <main className="min-h-screen bg-[#f5faff] px-4 py-10 text-[#062f5d] sm:px-6 sm:py-16">
      <article className="mx-auto w-full max-w-3xl rounded-[1.75rem] border border-[#dbe8f0] bg-white p-6 shadow-[0_24px_70px_-48px_rgba(24,50,47,0.55)] sm:p-10">
        <p className="text-sm font-semibold tracking-[0.02em] text-[#5c7e96]">
          Royal Glass preliminary reports
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-[#062f5d] sm:text-5xl">
          Privacy notice
        </h1>
        <p className="mt-5 text-base leading-7 text-[#426b87]">
          This notice applies when you ask Royal Glass for a preliminary pool
          feasibility report. The report is early planning guidance, not an
          approval, construction design, or quote.
        </p>

        <NoticeSection title="What we collect">
          <p>
            We collect your name, phone number, and email address; your visitor
            type and project timing; and any optional message you provide. We
            also save the checked property address, the selected address and
            parcel evidence, your chosen pool layout, mapped warnings and
            measurements, the report content, and the map image used in the
            report.
          </p>
        </NoticeSection>

        <NoticeSection title="Why we use it">
          <p>
            We use this information to prepare, display, and email your
            preliminary report, keep the submitted layout consistent, and let
            Royal Glass follow up about that report request. A report request
            does not sign you up for marketing or grant tracking consent.
          </p>
        </NoticeSection>

        <NoticeSection title="How long we keep it">
          <p>
            We keep the saved report request and its personal and property data
            for 12 months from submission, then delete that saved request
            automatically. We keep a separate retention-run record containing
            only the run identifier, date, cutoff date, and number of requests
            deleted. That audit record does not contain the deleted contact,
            property, layout, or report data.
          </p>
        </NoticeSection>

        <NoticeSection title="Services that process a request">
          <ul className="grid gap-3">
            <li>
              <strong className="text-[#062f5d]">Neon</strong> stores the saved
              report request for Royal Glass.
            </li>
            <li>
              <strong className="text-[#062f5d]">Resend</strong> receives the
              data needed to send both the homeowner report email and the
              ServiceM8 notification when those deliveries are enabled. The
              homeowner email includes the visitor email address and a summary
              of the saved preliminary report. The ServiceM8 notification
              includes the report reference, contact details, checked address,
              visitor type, and project timing.
            </li>
            <li>
              <strong className="text-[#062f5d]">ServiceM8</strong> receives a
              limited follow-up notification only when forwarding is enabled.
              That notification contains the report reference, contact details,
              checked address, visitor type, and project timing. It does not
              receive the report PDF, map image, or a saved-report link.
            </li>
          </ul>
          <p className="mt-4">
            Royal Glass&apos;s 12-month retention requirement applies to linked
            provider copies it controls as well as the saved request in Neon.
            You can use the support address below for access, correction, or
            early-deletion requests involving those services.
          </p>
        </NoticeSection>

        <NoticeSection title="Access, correction, or early deletion">
          <p>
            Email{" "}
            <a
              href="mailto:support@royalglass.co.nz"
              className="text-pool-blue-800 decoration-pool-blue-300 hover:text-pool-blue-950 focus-visible:outline-pool-blue-700 font-semibold underline underline-offset-4 outline-offset-4 focus-visible:outline-2"
            >
              support@royalglass.co.nz
            </a>{" "}
            to ask for access to your saved request, to correct it, or to ask
            for early deletion. Include the report reference and the email
            address used for the request. Royal Glass will verify that the
            request is from you or an authorised representative before
            disclosing or changing information.
          </p>
        </NoticeSection>

        <Link
          href="/"
          className="focus-visible:outline-pool-blue-700 mt-10 inline-flex min-h-11 items-center rounded-xl border border-[#9fc8df] px-4 text-sm font-semibold text-[#062f5d] outline-offset-4 transition hover:border-[#0077bd] hover:bg-[#e9f7ff] focus-visible:outline-2"
        >
          Return to the Property Check
        </Link>
      </article>
    </main>
  );
}

function NoticeSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-9 border-t border-[#dbe8f0] pt-7">
      <h2 className="text-xl font-semibold tracking-[-0.02em] text-[#062f5d]">
        {title}
      </h2>
      <div className="mt-3 text-base leading-7 text-[#426b87]">{children}</div>
    </section>
  );
}
