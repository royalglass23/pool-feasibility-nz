# Data classification - production report delivery

| Data | Classification | At rest | In transit | Retention | Notes |
| --- | --- | --- | --- | --- | --- |
| Name, phone, email, visitor type, timing, optional message | Personal / PII | Neon `homeowner_assessments`; Resend only after verified transaction | TLS browser-to-app and app-to-Resend | Neon: 12 months; Resend: 30 days verified 2026-08-05 | Do not place in URLs, logs, test fixtures, traces, or internal test copies. |
| Checked address, parcel evidence, pool layout, map, PDF and report content | Personal/property confidential | Neon and transient renderer memory; Resend attachment after verification | TLS browser/app/Resend | Same report-request lifecycle; provider retention separately governed | Production destination is only the verified recipient. |
| Recipient-verification capability | Confidential bearer capability | Server-side derived/hashed state or signed short-lived capability only | TLS POST/link flow only | Short-lived, single purpose | Must not grant report download or delivery by itself unless explicitly bound and verified. |
| Saved-report access token | Confidential bearer capability | Browser memory only; server signing key | TLS POST body | One hour | Bound to assessment UUID/reference; never URL, storage, logs, or artefacts. |
| Delivery claim, attempt state, safe error code, provider message ID | Internal/confidential | Neon | Server-to-Resend | Assessment lifetime | Provider message ID is never returned to the public caller. |
| Resend API key, report sender, signing key, database and Upstash credentials | Secret | Vercel encrypted environment variables only | Server-to-provider TLS | Operational rotation policy | No `NEXT_PUBLIC_` names or values in source, logs, test output, or artefacts. |
| Correlation ID and outcome category | Internal telemetry | Vercel runtime logs | Platform logs | Operational policy | Useful for support without email/address/token/PDF content. |

## Trust boundaries

1. Anonymous browser to public submission/verification routes.
2. Public API to server-only report token, database, rate-limit, renderer, and Resend boundaries.
3. Resend as an external processor; ServiceM8 is explicitly out of the Production delivery flow.
4. Renderer HTML/Chromium boundary, which must not load external content from saved data.
5. Browser, runtime logs, tests, traces, screenshots, and security evidence as sensitive-data exposure surfaces.

## NZ privacy lifecycle judgment

The report and its contact/property context are necessary only for the disclosed preliminary-report purpose. Production delivery must use the verified recipient's mailbox only, and Resend's current 30-day retention evidence must be rechecked before configuration. The existing 12-month Neon retention/deletion workflow remains required. Cross-border processing and operator controls are deployment/legal evidence, not proved by local source review.
