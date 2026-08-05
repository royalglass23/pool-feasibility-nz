# Security report - public-lead-capture

- Mode: retrofit
- Repository: `D:\Royal Glass Dev\geomap`
- Reviewed commit: `cc3f9204a772df716852576186c35079aabbed90`
- Candidate state: mixed uncommitted working tree
- Target: Auckland-first public traffic and report-request collection; no database migration, deployment, or production data use was authorised.
- Stack: Node.js, Next.js 16.2.12, React, Drizzle/Neon, Playwright.
- Verdict: **FAIL**

## Positive controls

- The form's visitor type/timing are positive enums; an Other value requires a bounded explanation at browser, server, persisted-contract, and database-constraint boundaries.
- The submitted checked address is sourced from a verified 15-minute HMAC snapshot, not browser form input. The server rebuilds the aggregate before persistence.
- Assessment request bodies are bounded, error responses are generic and `no-store`, and the route exposes only a correlation ID.
- Drizzle query builders/tagged SQL are parameterized. Idempotency keys and channel-specific delivery claims reduce duplicate delivery risk.
- The local focused lead-capture test lane passed 24 tests; typecheck, lint, build, and `git diff --check` passed.

## Findings

### SEC-PLC-001 - Public journey is blocked by a shared staff access boundary

- Severity: **High**
- Evidence: `src/proxy.ts` applies `authorizeInternalRequest` to every route. Outside loopback development, `src/modules/internal-access/authorize-internal-request.ts` requires shared HTTP Basic credentials.
- Impact: the proposed public traffic site cannot use the intended anonymous flow. Reusing shared Basic credentials for staff would not establish individual identity, roles, or record-level access.
- Required action: split public discovery/property/report-request endpoints from staff-only routes; introduce individual staff authentication and server-enforced per-record access before public deployment.

### SEC-PLC-002 - Publicly reachable costly operations have no abuse controls

- Severity: **High**
- Evidence: body, timeout, and idempotency bounds exist, but no selected rate limit, quota, CAPTCHA/anti-automation control, origin/CSRF policy, or bounded queue protects property lookup, map rendering, database, PDF, or email delivery.
- Impact: opening the route to traffic would permit cost/capacity abuse.
- Required action: implement an audience-appropriate rate-limiter and quota, anti-automation/origin policy, safe queueing, and observable rejection tests.

### SEC-PLC-003 - Privacy notice and personal-data lifecycle are incomplete

- Severity: **High**
- Evidence: the form records delivery/storage consent, but its current copy does not disclose delivery processors, retention, access/correction/deletion route, or a complete public privacy notice. `docs/persistence-boundary.md` explicitly defers retention, archive/delete, authentication, authorization, and CSRF protections.
- Impact: public collection would retain contact and precise property/project information without code-verifiable lifecycle controls.
- Required action: obtain approved privacy wording and processor/retention decisions, then implement retention/archive/delete/access/correction controls and tests. This is not legal certification.

### SEC-PLC-004 - Strict E2E evidence is absent

- Severity: **High**
- Evidence: [e2e-matrix.md](e2e-matrix.md) maps seven required rows, none has a real-boundary implementation. The attempted mocked diagnostic command could not start because a user-owned local server already owns the build state; even if it ran, it would not cover required rows. See [e2e-results.md](e2e-results.md).
- Impact: anonymous access, snapshot forgery, persistence/idempotency, PII leakage, abuse controls, privacy notice, and staff authorisation are not proven against the application boundary.
- Required action: provision isolated DB and fake delivery capture, implement matrix tests, use production build with zero retries, and validate the exact commit evidence.

### SEC-PLC-005 - Security/audit event coverage is incomplete

- Severity: **Medium**
- Evidence: delivery failure logs a reference/correlation ID without PII, but no complete privacy-safe event path covers access denials, validation/abuse rejection, staff reads, assessment creation, and delivery outcomes.
- Required action: define redacted audit events, retention, and alert/inspection procedure.

### SEC-PLC-006 - Fresh dependency audit is not current evidence

- Severity: **Medium**
- Evidence: runtime build confirms Next.js 16.2.12, but a fresh `npm audit --json --omit=dev` was not run because it requires external network authorisation.
- Required action: authorise the audit, record results, and remediate any applicable findings.

## Standards assessed

### OWASP Top 10:2021

| Category | Result | Evidence |
| --- | --- | --- |
| A01 Broken Access Control | FAIL | SEC-PLC-001; no production staff identity/object policy |
| A02 Cryptographic Failures | BLOCKED | Server-only secret boundary exists; public TLS/at-rest/processor evidence absent |
| A03 Injection | PASS at code boundary | Zod validation, React encoding, parameterized Drizzle |
| A04 Insecure Design | FAIL | Public audience does not have a safe access/abuse/privacy design |
| A05 Security Misconfiguration | FAIL | Global proxy conflicts with public scope; deployment headers/evidence absent |
| A06 Vulnerable Components | BLOCKED | Fresh audit not authorised |
| A07 Authentication Failures | FAIL | Shared Basic is not public/staff identity architecture |
| A08 Data Integrity | BLOCKED | Server snapshot control is positive; real persistence E2E absent |
| A09 Logging/Monitoring | FAIL | SEC-PLC-005 |
| A10 SSRF | PASS at code boundary | Fixed/allow-listed provider patterns and bounded renderer path |

### OWASP ASVS 4.0 Level 2

| Chapter | Result | Evidence |
| --- | --- | --- |
| V1 Architecture | FAIL | Threat model exists; public/staff boundary remains unsafe |
| V2 Authentication / V4 Access Control | FAIL | SEC-PLC-001 |
| V3 Session Management | BLOCKED | Production identity/session design not selected |
| V5 Validation / Encoding | PASS at code boundary | Positive schemas and framework encoding |
| V6 Stored Cryptography / V8 Data Protection / V9 Communications | BLOCKED | At-rest, retention, processor, and TLS evidence unavailable |
| V7 Error Handling / Logging | FAIL | SEC-PLC-005 |
| V10 Malicious Code | BLOCKED | Fresh audit unavailable |
| V11 Business Logic / V13 API | FAIL | SEC-PLC-002 and no strict E2E |
| V12 Files/Resources | PASS at code boundary | Bounded PNG/PDF response controls |
| V14 Configuration | FAIL | Public release configuration is not ready |

### NZ Privacy Act 2020 - code-verifiable controls

| Principle | Result | Evidence |
| --- | --- | --- |
| IPP1 purpose / IPP2 source | PARTIAL PASS | Direct collection for preliminary-report delivery is defined; property data originates from the checked address flow. |
| IPP3 awareness / IPP4 manner | FAIL | Consent exists, but the public collection notice is incomplete. |
| IPP5 security | FAIL | No public access model, leakage E2E, at-rest, or processor evidence. |
| IPP6 access / IPP7 correction | FAIL | No data-subject route exists. |
| IPP8 accuracy | PARTIAL PASS | Contact data is bounded; property address/report basis is snapshot-derived, pending real-boundary proof. |
| IPP9 retention | FAIL | No period or executable deletion mechanism. |
| IPP10 use limitation | BLOCKED | Intended delivery purpose is clear, but operational enforcement is unproven. |
| IPP11 disclosure / IPP12 cross-border | FAIL | Resend/ServiceM8/Neon disclosure, regions, and safeguards are not implemented in the notice or evidence. |
| IPP13 unique identifiers | PARTIAL PASS | Assessment IDs/references are feature-scoped; no public account identifier is created. |
| Breach readiness | FAIL | Audit coverage is insufficient to detect and scope a breach. |

This maps code-verifiable controls only; privacy officer, legal wording, processor contracts, complaints, and notification obligations require separate human/legal work.

## Release judgment

Do not publish the public lead-capture flow, apply the migration for customer traffic, or treat local green checks as release approval. The outcome is FAIL due to open High findings; strict E2E remains BLOCKED independently.
