import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy notice | PoolReady",
  description:
    "How PoolReady handles personal and property information submitted for a preliminary pool report or contact enquiry.",
};

export default function PrivacyNoticePage() {
  return (
    <main className="min-h-screen bg-[#f5faff] px-4 py-10 text-[#062f5d] sm:px-6 sm:py-16">
      <article className="mx-auto w-full max-w-3xl rounded-[1.75rem] border border-[#dbe8f0] bg-white p-6 shadow-[0_24px_70px_-48px_rgba(24,50,47,0.55)] sm:p-10">
        <p className="text-sm font-semibold tracking-[0.02em] text-[#5c7e96]">
          PoolReady reports and enquiries
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-[#062f5d] sm:text-5xl">
          Privacy notice
        </h1>
        <p className="mt-5 text-base leading-7 text-[#426b87]">
          This notice applies when you ask for a preliminary pool feasibility
          report or send us a contact enquiry. The report is early planning
          guidance, not an approval, construction design, or quote.
        </p>

        <NoticeSection title="What we collect">
          <p>
            For a report request, we collect your name, phone number, and email
            address; your visitor type and project timing; and any optional
            message you provide. We also save the checked property address, the
            selected address and parcel evidence, your chosen pool layout,
            mapped warnings and measurements, the report content, and the map
            image used in the report. For a contact enquiry, we collect only
            your name, email address, and message.
          </p>
        </NoticeSection>

        <NoticeSection title="Why we use it">
          <p>
            We use report-request information to prepare, display, and email
            your preliminary report and keep the submitted layout consistent. We
            use contact-enquiry information only to respond to your message.
            Neither route signs you up for marketing or grants tracking consent.
          </p>
        </NoticeSection>

        <NoticeSection title="Optional analytics">
          <p>
            If you choose <strong>Allow analytics</strong> on the Property
            Check, Hotjar records anonymous interaction patterns to help
            PoolReady improve that journey. It does not load until you choose
            it, and you can turn it off at any time through Analytics settings.
            Your property search, map, report, contact details, and free text
            are excluded from Hotjar.
          </p>
        </NoticeSection>

        <NoticeSection title="How long we keep it">
          <p>
            We keep the saved report request and its personal and property data
            for 12 months from submission, then delete that saved request
            automatically. We keep a separate retention-run record containing
            only the run identifier, date, cutoff date, and number of requests
            deleted. That audit record does not contain the deleted contact,
            property, layout, or report data. Contact enquiries are not stored
            in the PoolReady application database; they are delivered to the
            support inbox for response and follow that inbox&apos;s retention
            policy.
          </p>
        </NoticeSection>

        <NoticeSection title="Services that process a request">
          <ul className="grid gap-3">
            <li>
              <strong className="text-[#062f5d]">Hotjar</strong> receives
              anonymous PoolReady interaction data only after you allow
              analytics. It is not installed on staff pages.
            </li>
            <li>
              <strong className="text-[#062f5d]">Neon</strong> stores saved
              report requests.
            </li>
            <li>
              <strong className="text-[#062f5d]">Resend</strong> receives the
              data needed to send the homeowner report email and the ServiceM8
              notification when those deliveries are enabled. It also delivers
              contact enquiries to the support inbox. A contact enquiry includes
              only the name, email address, and message entered in the form.
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
            The 12-month retention requirement applies to linked provider copies
            controlled alongside a saved request in Neon. You can use the
            contact form below for access, correction, or early-deletion
            requests involving those services.
          </p>
        </NoticeSection>

        <NoticeSection title="Access, correction, or early deletion">
          <p>
            Use the Contact us button at the bottom of PoolReady to ask for
            access to your saved request, to correct it, or to ask for early
            deletion. Include the report reference and the email address used
            for the request. We will verify that the request is from you or an
            authorised representative before disclosing or changing information.
          </p>
        </NoticeSection>

        <Link
          href="/"
          className="focus-visible:outline-pool-blue-700 mt-10 inline-flex min-h-11 items-center rounded-xl border border-[#9fc8df] px-4 text-sm font-semibold text-[#062f5d] outline-offset-4 transition hover:border-[#0077bd] hover:bg-[#e9f7ff] focus-visible:outline-2"
        >
          Return to PoolReady
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
