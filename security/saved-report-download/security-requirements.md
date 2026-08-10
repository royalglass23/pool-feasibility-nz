# Security requirements - saved report download and delivery

- Date: 2026-08-10
- Mode: retrofit
- Reviewed commit: `ea35f9c306fb2bef11ef4011c9883f3bdc51be0d`
- Candidate state: uncommitted working tree
- Target: isolated local/test only; no production deployment, configuration change, database write, or live delivery is authorised.

## Actors and protected assets

- Anonymous visitor/homeowner: untrusted until a server-issued capability is verified.
- Bearer-token holder: authorised only for the assessment UUID/reference and actions encoded by the capability.
- Automated or malicious caller: untrusted, including distributed callers and forged submissions.
- Royal Glass staff/support: privileged for separately protected staff/privacy workflows; not authorised by a homeowner token.
- Neon, Upstash, Resend, LINZ and ServiceM8: external trust boundaries with separate credentials, availability and privacy obligations.
- Protected assets: saved personal/property data, report PDF/map, delivery destinations and state, signing/provider/database secrets, rate-limit capacity, renderer capacity, provider message IDs, and retention evidence.

## Testable acceptance criteria

1. A valid short-lived token can access only the persisted report bound to its signed UUID and reference.
2. Missing, expired, malformed, non-canonical, wrong-purpose and tampered report-access tokens fail uniformly before database, renderer or delivery work.
3. Public request bodies are byte-bounded and strict-schema validated; caller-controlled object IDs and active URL schemes are rejected.
4. PDF responses are attachment-only, non-cacheable, correctly typed, safely named and contain no unnecessary contact data or active untrusted links.
5. The controlled Test Report Delivery immediately sends the same PDF once to the submitted synthetic test email and once to `royalglass666@gmail.com`, using independent durable claims and provider idempotency; it has no verification step and cannot use customer data.
6. Public PDF, delivery and submission costs are constrained across instances and cannot be bypassed by replaying one capability through many IPs.
7. The production path fails closed when managed rate limiting, signing, database, renderer or delivery configuration is absent.
8. Tokens, credentials and personal/report data are absent from URLs, browser storage, logs, errors and retained test artefacts.
9. Test environments send identical PDF copies to the synthetic test user's entered address and `royalglass666@gmail.com`; ServiceM8 forwarding remains disabled until its processor-retention/privacy gate is satisfied.
10. Strict browser/API evidence crosses real application routing, token verification, persistence, renderer and controlled provider-adapter boundaries in an isolated production-like environment, with one worker and zero retries.

## Abuse cases

- Steal or replay a report capability to download a report or trigger delivery.
- Substitute another assessment ID/reference or use a token from another token family/action.
- Supply malformed Unicode signatures, oversized JSON, unknown fields, hostile encodings or active-scheme attribution URLs.
- Submit another person's email/contact details to cause unsolicited messages or false leads; the simplified unverified flow is accepted only for controlled synthetic testing and remains a production blocker.
- Share a valid token across many IPs to exhaust PDF renderer or delivery capacity.
- Race or repeat delivery to duplicate messages or corrupt durable channel state.
- Force provider/renderer/limiter failures to obtain partial reports, stale state, leaked errors or bypassed controls.
- Leak PII or secrets through URLs, PDF links, logs, browser state, traces, screenshots or provider payloads.

## Compliance and non-goals

- Code-verifiable NZ Privacy Act 2020 controls apply because the feature handles identifiable contact and property data. The current review includes IPP3A, effective from 1 May 2026, for indirect collection and representative-submission scenarios.
- Organisational/legal determinations, provider contracts, production secret provisioning and privacy-officer processes are not proven by this repository audit.
- The approved test mailbox may receive synthetic fixture data only; it is not an authorised destination for customer or production report requests.
- This feature does not authenticate the visitor as the property owner, issue a consent/engineering decision, create a ServiceM8 job, or authorise production release.

## Compromise blast radius

A full compromise could expose retained homeowner contact/property reports, send unsolicited or duplicate messages, create false operational leads, exhaust serverless renderer/provider capacity, disclose server credentials, and breach Royal Glass privacy/retention obligations. Object-bound tokens and fixed delivery destinations reduce cross-record and arbitrary-recipient impact but do not eliminate capability replay or submission spoofing.
