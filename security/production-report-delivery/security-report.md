# Security report - production report delivery

- Stack: Node/Next.js 16.2.12 (`.secure-sdlc/stack.json`)
- Compliance: NZ Privacy Act 2020 code-verifiable slice
- Mode: retrofit
- Base commit: `6c2cac6d376b773d3269c493cc21a2aa66a6d9a6`; reviewed candidate: uncommitted recipient-verification implementation
- Target: proposed Vercel Production transactional report delivery; no deployment, secret write, production database write, or live email was performed.

## Architecture and trust boundary review

The public delivery route uses a byte-bounded strict JSON body, verifies a one-hour object-bound report capability server-side, checks a bound persisted assessment, then delegates to durable delivery claims. The route is rate-limited before database, renderer, and delivery work. The renderer and Resend adapter remain server-only. The candidate now distinguishes Preview/local `synthetic_test` fan-out from a `production` policy that is accepted only in Vercel Production, claims only the homeowner channel, sends a verification-only email first, and requires a signed short-lived confirmation capability before attaching the PDF.

The confirmation capability is kept in the URL fragment, then removed from the address bar before the browser POST. Both delivery routes return generic public errors and write only event, outcome, safe reason, and correlation ID to runtime logs. The implementation passes unit/API-boundary evidence but has no isolated provider, renderer, limiter, database, or runtime-log E2E proof.

## Findings

| ID          | Severity                        | Finding                                                                                                                       | Evidence                                                  | Required action                                                                                                                      |
| ----------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| PRD-SEC-001 | Remediated at unit/API boundary | Production now sends verification-only email first and requires a signed short-lived recipient capability before PDF delivery | verification token, verification route, and focused tests | Obtain isolated mailbox-capture E2E proof before release.                                                                            |
| PRD-SEC-002 | Remediated at unit boundary     | Production policy claims only homeowner; internal test remains synthetic-only                                                 | policy and delivery focused tests                         | Obtain isolated capture proof before release.                                                                                        |
| PRD-SEC-003 | Remediated at unit boundary     | Explicit `production` mode is Vercel-Production-only; other combinations fail closed                                          | policy focused tests and environment schema               | Obtain isolated configuration-matrix E2E proof before release.                                                                       |
| PRD-SEC-004 | High                            | Strict E2E evidence covers none of the 10 required security rows                                                              | `e2e-matrix.md`, `e2e-results.json`                       | Provide isolated production-shaped DB, email capture, limiter, safe log capture, fixtures, and zero-retry Playwright tests.          |
| PRD-SEC-005 | High                            | Production dependency audit reports three high and one moderate advisory                                                      | `npm.cmd audit --omit=dev --json`, 2026-08-14             | Upgrade Next to the offered non-major 16.3.0 fix, then regenerate/validate the lockfile before release.                              |
| PRD-SEC-006 | Remediated at code boundary     | Delivery and verification failures log safe event/outcome/reason/correlation fields                                           | both public delivery routes                               | Capture and inspect isolated runtime logs before release.                                                                            |
| PRD-SEC-007 | High release gate               | Processor and Production secret evidence cannot be proven from the checkout                                                   | Existing privacy record is dated 2026-08-05               | Revalidate Resend retention and configure only approved server variables through Vercel's production workflow; keep ServiceM8 unset. |

## OWASP Top 10:2021

| Category                         | Result                                  | Notes                                                                                                                |
| -------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| A01 Broken Access Control        | BLOCKED                                 | Object-bound report access and recipient confirmation have focused proof; strict cross-record E2E remains absent.    |
| A02 Cryptographic Failures       | BLOCKED                                 | TLS/server-side keys are designed; Production key-store/runtime/log proof is unavailable.                            |
| A03 Injection                    | PASS at bounded code review             | Zod body validation, escaped email HTML, Drizzle query builder; strict real-boundary hostile-input proof is missing. |
| A04 Insecure Design              | PASS at code boundary / BLOCKED release | Recipient verification and Production-only channel policy are implemented; strict E2E remains absent.                |
| A05 Security Misconfiguration    | BLOCKED                                 | Explicit mode matrix exists; Production variables and production-shaped configuration proof are unavailable.         |
| A06 Vulnerable Components        | FAIL                                    | Audit: 3 high, 1 moderate; Next `16.3.0` is the reported non-major fix path.                                         |
| A07 Identification/Auth Failures | PASS at code boundary / BLOCKED release | Recipient confirmation is signed and short-lived; live mailbox proof is absent.                                      |
| A08 Software/Data Integrity      | BLOCKED                                 | Provider idempotency exists; Production deployment/config integrity evidence is unavailable.                         |
| A09 Logging/Monitoring           | BLOCKED                                 | Correlation ID exists, but safe delivery-stage runtime evidence/alerts are unavailable.                              |
| A10 SSRF                         | PASS at bounded code review             | Renderer aborts requests and provider adapters are allow-listed; Production-like proof remains in strict E2E.        |

## ASVS 4.0 Level 2

V1 architecture: PASS as documented. V2/V3 are N/A to the anonymous report-recipient flow except for short-lived capability handling. V4 access control: PASS at code boundary, BLOCKED in live proof. V5 validation/encoding: PASS at code review, BLOCKED at real boundary. V6 stored cryptography: BLOCKED for Production secret-store proof. V7 errors/logging: PASS at code boundary, BLOCKED in runtime evidence. V8 data protection: PASS at code boundary, BLOCKED for Production runtime proof. V9 communications: BLOCKED for deployed proof. V10 dependency integrity: FAIL. V11 business logic: PASS at focused boundary, BLOCKED for capture/replay E2E. V12 files/resources: PASS at code review for transient generated attachments, BLOCKED in live renderer proof. V13 API: BLOCKED for the required E2E matrix. V14 configuration: BLOCKED.

## NZ Privacy Act 2020 code-verifiable slice

IPP1/2/3/4: delivery purpose and notice exist; recipient confirmation materially reduces mistargeted use. IPP5: BLOCKED pending runtime secret/log evidence and strict E2E. IPP6/7: existing protected Staff/privacy process is documented, but not exercised here. IPP8: report input schemas and mailbox-control verification exist at code boundary; live proof is unavailable. IPP9: Neon retention and Resend 30-day record exist, but must be revalidated. IPP10/11: Production is homeowner-only and excludes internal test/ServiceM8 at code boundary. IPP12: external processor/region safeguards require operator/legal confirmation. IPP13: report identifiers are necessary and capability-bound; no new cross-agency identifier is proposed.

## E2E and pentest evidence

The strict E2E matrix has 10 required rows and zero covered rows. This is BLOCKED, not a substitute for the tested failures above. The manual probe record is [pentest.md](pentest.md); no destructive or Production probe was performed.

## Verdict

**FAIL.** PRD-SEC-004 (strict E2E), PRD-SEC-005 (dependency advisories), and PRD-SEC-007 (processor/Production configuration evidence) block Production enablement. PRD-SEC-001, PRD-SEC-002, PRD-SEC-003, and PRD-SEC-006 are remediated only at the focused code/unit boundary.
