# Public lead-capture implementation plan

## Purpose

Move the Auckland-first Property Check from a protected internal workflow to a safe public report-request flow. This plan implements the decisions in `CONTEXT.md`, [ADR 0001](adr/0001-staff-magic-link-access.md), and [ADR 0002](adr/0002-public-report-delivery-boundary.md). It does not authorise deployment, a production migration, a final hostname, or customer-data collection.

## Locked launch decisions

- The Property Check and report request are anonymous public paths.
- The checked address stays server-derived from the signed Property Check snapshot.
- A visitor receives the preliminary report as a PDF email attachment.
- ServiceM8 receives a concise saved-lead notification: reference, contact details, checked address, visitor type, and timing; never a report link, PDF, or map attachment.
- Report-request data is retained for 12 months. `support@royalglass.co.nz` handles manual access, correction, and early-deletion requests.
- The privacy notice names Neon, Resend, and ServiceM8 only when forwarding is enabled.
- Vercel remains a noindex test deployment until a final hostname is selected.
- GA4 requires separate analytics-cookie consent and receives no personal/property/report data. Search Console is configured only for the final hostname.
- The Staff Workspace is one Admin username/password account, created by a one-time local bootstrap command; 14-character minimum password, 8-hour session, and five-failure/15-minute login lockout.
- Public limits are 10 Property Checks per IP every 30 minutes and 3 report requests per IP every hour, with a calm retry message.

## Phase 1 - Public and admin boundaries

1. Replace the app-wide shared Basic gate with two explicit boundaries:
   - anonymous public routes/pages required for discovery, Property Check, and report request;
   - authenticated Admin-only routes for saved requests and report retrieval.
2. Add Admin account and session storage. Passwords use a modern slow password hash, never plaintext; sessions use secure, httpOnly, sameSite cookies and expire after eight hours.
3. Add the local Admin bootstrap command. It prompts for credentials, is excluded from normal runtime routes, and cannot create a public registration path.
4. Add login lockout state and clear failure messaging. Admin routes deny direct access without a valid session.

**Acceptance evidence:** anonymous visitor can complete the public journey without staff credentials; direct Admin route/API access is denied; valid Admin can view saved requests; expired/locked sessions are denied.

## Phase 2 - Lead persistence and delivery

1. Apply the already-generated visitor-context migration only to an explicitly approved development database, then verify its constraints.
2. Update delivery behavior:
   - send the visitor PDF attachment;
   - send the reduced ServiceM8 notification, with no attachment or report link;
   - preserve idempotency so a retry does not duplicate a saved request or already-completed destination.
3. Add an explicit privacy notice immediately before Report Delivery Consent. It covers purpose, the 12-month retention period, declared processors, `support@royalglass.co.nz`, and no marketing consent.
4. Implement a scheduled retention path that deletes expired report requests and a controlled Admin workflow for a verified Privacy Request.

**Acceptance evidence:** a saved request has the complete visitor context; visitor and ServiceM8 messages have their correct, different payloads; deletion/retention removes the expected personal/property data without affecting unrelated fixtures.

## Phase 3 - Public abuse and analytics controls

1. Select and configure a managed shared rate-limit store before public traffic. Do not use in-memory limits on Vercel; the current preferred category is a managed Redis-compatible service such as Upstash.
2. Enforce the agreed limits at the Property Check and report-request boundaries, returning `429` with a calm retry message and no partial record/delivery.
3. Restrict cross-origin form/API use to the final public hostname once selected. Keep the Vercel test deployment noindex and out of Search Console.
4. Add GA4 behind analytics-cookie consent. Event names describe funnel progression only; event payloads exclude all contact, address, coordinate, report, and ad-retargeting data.

**Acceptance evidence:** limits hold across more than one Vercel instance; rejected requests have no database/delivery effect; GA4 is absent before consent and contains no prohibited fields after consent.

## Phase 4 - Security and release proof

1. Provision an isolated test database and fake email/ServiceM8 capture; never use production data or live delivery for destructive tests.
2. Implement every required row in [the security E2E matrix](../security/public-lead-capture/e2e-matrix.md): anonymous public submission, signed-snapshot integrity, hostile input, privacy notice, rate limits, leakage checks, and Admin authorisation.
3. Run the production build E2E lane once with zero retries and validate `e2e-results.json` against the exact reviewed commit.
4. Perform the authorised dependency audit, review Vercel headers/TLS/final-origin settings, and rerun the Secure SDLC sign-off.

**Release gate:** all High findings in [the current security report](../security/public-lead-capture/security-report.md) are remediated, strict E2E evidence is PASS, and the final hostname plus managed rate-limit store are configured. Until then, the Vercel deployment remains test-only and noindex.

## Deliberately deferred

- Final public hostname and Search Console property.
- Multi-staff roles and account management.
- Pool builder matching, quote pricing, and marketing automation.
- ServiceM8 job/API integration; launch uses the limited email notification only.
