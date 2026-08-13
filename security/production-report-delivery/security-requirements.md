# Security requirements - production report delivery

- Date: 2026-08-13
- Mode: retrofit
- Base commit: `6c2cac6d376b773d3269c493cc21a2aa66a6d9a6`; reviewed candidate: uncommitted recipient-verification implementation
- Target: Vercel Production report delivery; no deployment, secret write, database mutation, or live email has been performed by this review.

## Actors and protected assets

- Anonymous submitter: untrusted until the report recipient controls the supplied mailbox.
- Verified report recipient: may receive only the report bound to the submitted property-check record.
- Bearer-token holder: may retry delivery only for the bound assessment during the token lifetime.
- Royal Glass operator: can inspect delivery state through the protected Staff Workspace but cannot use a homeowner capability to access a different report.
- Resend: the approved transactional email processor; ServiceM8 remains disabled.
- Protected assets: homeowner identity and contact details, checked address, pool layout, PDF/map, report capability, delivery state, provider message ID, database/signing/Resend credentials, and renderer/rate-limit capacity.

## Testable acceptance criteria

1. Production delivery is enabled only by an explicit server-only production mode; missing, malformed, Preview, or local modes fail closed before any claim, PDF render, or Resend call.
2. Production sends the saved PDF only after the submitted mailbox completes the signed, one-hour report-recipient verification control. It never sends the customer report to `royalglass666@gmail.com` or ServiceM8.
3. Preview/local `synthetic_test` delivery may send the same synthetic PDF to the submitted test address and fixed internal test mailbox; this path rejects Production.
4. A verified recipient can receive or retry only their assessment's report through the short-lived, object-bound report capability; altered, expired, cross-record, malformed, oversized, or replay-abusive requests do no database, renderer, or delivery work.
5. Delivery has durable per-channel claims and stable provider idempotency. A retry cannot duplicate an already-sent homeowner email.
6. Renderer or Resend failure leaves a safe, retryable delivery state, exposes no token, PII, provider response, or stack trace, and records a safe correlation outcome for operators.
7. Production requires server-only `RESEND_API_KEY`, `REPORT_FROM_EMAIL`, report-token signing material, database, and managed rate limiting. Client bundles, URLs, logs, browser storage, and committed evidence contain none of their values.
8. Transactional report-delivery consent and the privacy notice disclose the Resend purpose. ServiceM8 forwarding remains absent. Resend's current 30-day retention record must be revalidated before enabling the Production variables.
9. An isolated non-production production-shaped lane proves recipient verification, object authorization, no internal-test copy, retry/idempotency, renderer failure isolation, and no PII/token leakage with zero Playwright retries.

## Abuse cases

- An attacker submits a victim's address to send unsolicited property reports or infer property information.
- A stolen or replayed report capability reads or delivers another homeowner's report.
- A caller races delivery retries to duplicate emails or exhaust renderer capacity.
- A configuration drift enables synthetic internal forwarding in Production or permits delivery when mandatory secrets are absent.
- A PDF, email, log, response, trace, or browser surface discloses unnecessary personal/property data, credentials, or capabilities.
- A malformed/oversized request, cross-record identifier, hostile text, or provider failure bypasses checks or leaks internal errors.

## Compliance, non-goals, and blast radius

- The feature processes personal and property data; code-verifiable NZ Privacy Act 2020 controls, including IPP3, IPP5, IPP9, IPP10, IPP11, and IPP12, apply.
- Production email is transactional report delivery, not marketing, ServiceM8 lead forwarding, construction approval, a public report register, or an unverified email blast.
- A full compromise could disclose saved reports or credentials, send unsolicited/duplicate emails, exhaust PDF rendering, or create a privacy breach. Recipient verification, object-bound tokens, durable idempotency, fixed production destinations, rate limits, and safe observability reduce that blast radius.
