# Founding Partner Program

The approved PoolReady partner-program mockup is implemented at `/partners`, using
the supplied `PoolReady_Founding_Partner_Program_Premium.pdf` as the content source.
The page presents all five benefits, practical-feedback expectations, prior approval
for case-study material, and a limited initial group. It offers an enquiry, not
automatic programme admission. Complimentary access applies during early access;
lead consideration and network-dependent benefits retain their qualifications.

## Branding and navigation

The shared header links the PoolReady logo home and displays `powered by BlueHaven`
with a link to `https://www.bluehaven.nz/`. It includes property-check and partnership
navigation. The shared public footer repeats the brand links, partnership link,
privacy notice and existing contact dialog. Staff/prototype pages retain header
branding but omit the public footer. No BlueHaven WordPress pages are changed in
this repository. The proposed reciprocal links there are a property-planning CTA
to `https://www.poolready.co.nz/` and a professional-program link to
`https://www.poolready.co.nz/partners`.

## Email routing

`REPORT_FROM_EMAIL` is the verified **sender**, not the destination.
`RESEND_API_KEY` authenticates sending. Both general and partnership enquiries go
to the existing approved `support@bluehaven.nz` inbox. Reply-To is the visitor's
submitted email address. Visitors cannot supply a destination or subject.

| Event                                   | Recipient                 | Subject                                                         |
| --------------------------------------- | ------------------------- | --------------------------------------------------------------- |
| Partnership enquiry                     | Support inbox             | `[PoolReady] Founding Partner enquiry`                          |
| General enquiry                         | Support inbox             | `[PoolReady] General enquiry`                                   |
| Submitted property-check report request | Support inbox             | `[PoolReady] Property check report requested - <address>`       |
| Homeowner report copy                   | Submitted visitor address | Existing `Your Preliminary Pool Feasibility Report - <address>` |

The existing report submission/delivery trigger and retry controls are unchanged.
Browsing, searching an address or positioning a pool alone does not send a notification.

## Contact boundary

Both enquiry forms use `POST /api/public/contact` and the same three-attempt
hourly rate-limit budget. General enquiries retain name, email and a required
message; partnership enquiries add a required company and allow an optional
message. The server validates lengths and purpose, escapes HTML, bounds the
request stream to 16,000 bytes, ignores honeypots and logs no submitted fields.
Enquiries are emailed through the existing Resend adapter, without a new database
table, marketing signup or provider. The privacy notice describes the company field.

Unchanged-message retries reuse an idempotency key; an edited message gets a new
key. The success state appears only after acceptance. A failure preserves fields.
The local-only `CONTACT_DELIVERY_MODE=synthetic_test` sink allows browser testing
without delivering email. It remains prohibited in Vercel deployments.

## Acceptance checks

- `/partners` shows all program terms and the form on desktop/mobile.
- Submission reaches the contact handler with partnership purpose and company.
- Missing company, invalid email, oversized content and delivery overrides fail.
- An unchanged failed submission retries with the same idempotency key.
- General-contact and report-delivery tests retain their original routing.
- Shared brand links are present on home, partners, privacy and guidance pages.
- Tests use synthetic data and injected mail adapters; they do not prove live
  Resend delivery. No deployment, migration or real email send is part of this change.

Run `npm run test:e2e:contact` for contact and partner browser acceptance. The
dedicated configuration starts a fresh local server on port 3012, explicitly
enables the synthetic sink and local rate limiter, clears delivery credentials,
and refuses to reuse a running server. These two specs are excluded from the
default Playwright configuration so a normal dev server cannot receive test emails.
