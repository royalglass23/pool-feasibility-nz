# Security report - MT-242

- Feature: Geomap v2 nationwide fast homeowner pool feasibility workflow
- Mode: retrofit
- Repository: `D:\Royal Glass Dev\geomap`
- Branch: `dev`
- Reviewed base commit: `8783a6b4d0cfdc0beb53d63edf05b9fb7e49e70a`
- Candidate state: mixed uncommitted working tree
- Target: isolated local development only
- Stack: Node.js / Next.js 16.2.12 / React / PostgreSQL with Drizzle
- E2E runner: Playwright
- Compliance profile: code-verifiable NZ Privacy Act 2020 controls
- Verdict: **FAIL**

## Scope and authorization boundary

This audit covers MT-242's address-first workflow and the currently present descendant work for
fast property display, persisted homeowner assessments, saved reports/PDF/email delivery, and the
development-only staff dashboard. Production/customer deployment, production data, live provider
smoke tests, real email, branch creation, commit, push, merge, and deployment were not authorized
and were not performed. On 2026-07-30, the user explicitly authorized applying the three local
Drizzle migrations to the configured development database for diagnostic tests only.

The PRD explicitly excludes staff authentication from this development-stage slice and says the
records contain personal/property data. The current app-wide `src/proxy.ts` applies the existing
internal Basic boundary to all routes, while assessment list/detail handlers additionally fail
closed outside `development`/`test`. That is a containment measure, not a production access model.

## Architecture review

### Positive controls

- The proxy denies non-loopback requests unless paired internal credentials are configured and
  compares credentials in constant time.
- Assessment handlers return `no-store`; saved PDF responses also set `nosniff`.
- The persisted Zod schema bounds body size, nested strings/arrays, coordinates, GeoJSON, and PNG
  content before storage and report generation.
- Drizzle query builders and tagged SQL are parameterized; no concatenated SQL sink was found.
- The assessment table has uniqueness, status, timing, consent, feasibility, and delivery-state
  constraints.
- Delivery claims are channel-specific, token-bound, recover stale workers, and use deterministic
  provider idempotency keys.
- Report/email text is HTML-escaped; the PDF renderer blocks every network request, limits one
  render per process, and has a timeout.
- Provider credentials are server-only; external GIS origins and the Resend endpoint are fixed or
  allow-listed.
- Focused tests, typecheck, lint, and production build passed.

### Architectural failures

- The untrusted browser constructs the authoritative assessment aggregate. The server validates
  shape and internal consistency, then persists and emails it without binding it to server-derived
  address/evidence/layout state.
- The proxy remains a development containment boundary rather than a production identity and
  object-authorisation model. The affected Next.js package range has been remediated locally, but
  a fresh remote production audit could not be run without sending dependency metadata to npm.
- The personal-data lifecycle, production identity/authorization, rate limits, audit trail, and
  strict isolated E2E environment are deferred.
- The candidate is uncommitted and mixed with other work, so runtime evidence cannot bind to an
  immutable reviewed commit.

## Findings

### SEC-242-001 - Client-authored facts can forge the saved report

- Severity: **High**
- Status: Open
- Evidence:
  - `HomeownerSubmissionForm` sends address evidence, geometry, warning state, recommendations,
    report facts, consent version, and consent timestamp.
  - `persistedAssessmentSubmissionSchema` validates bounds and compares each supplied warning
    state only to the supplied overall state.
  - `POST /api/internal/assessments` parses that object and passes it directly to
    `saveHomeownerAssessment`.
  - Empty warnings are accepted, so a provisional/missing boundary can be paired with a
    self-consistent client-supplied `no_warning` report.
- Risk: invented evidence or downgraded warnings can be stored, displayed to staff, rendered to
  PDF, and emailed as a Royal Glass report. Client-supplied consent audit facts can also be forged.
- Required action: persist from a signed/server-side snapshot or recompute the complete aggregate
  server-side; bind it to the address, loaded evidence, construction envelope, map, and
  server-established consent record.
- Release impact: blocker; OWASP A04/A08, ASVS V1/V5/V11/V13, NZ Privacy IPP8.

### SEC-242-002 - Affected Next.js proxy dependency range (remediated locally; audit recheck blocked)

- Severity: **High**
- Status: **Remediated in the local candidate; remote audit verification blocked**
- Historical evidence: `npm.cmd audit --json --omit=dev` on 2026-07-29 found Next.js 16.2.10 in
  GHSA-6gpp-xcg3-4w24 (`>=16.0.0 <16.2.11`) and a transitive `sharp` advisory. The exact published
  exploit condition also requires App Router, Turbopack, and a single-entry `i18n.locales` config;
  this repository has no `i18n` config, so that known condition was absent even before the upgrade.
- Remediation evidence: `package.json`, `pnpm-lock.yaml`, and `package-lock.json` now pin Next.js
  and `eslint-config-next` at 16.2.12, above the advisory's fixed 16.2.11 version. The installed
  runtime built as `Next.js 16.2.12`; anonymous and invalid Basic credentials received `401` with
  `Cache-Control: no-store`, while valid Basic credentials reached request validation (`400`).
- Verification gap: the fresh `npm.cmd audit --json --omit=dev` request was not authorised because
  it would send dependency metadata to npm. Therefore removal of the prior `sharp` finding is not
  independently re-confirmed in this candidate.
- Remaining release impact: production identity/object authorisation and strict E2E evidence remain
  blockers; this item no longer asserts the application uses an affected Next.js version.

### SEC-242-003 - Costly operations have no reachable-audience abuse control

- Severity: **High**
- Status: Open
- Evidence: request/image/provider/PDF/email timeouts and bounds exist, but no per-principal/IP
  rate limiter or quota protects assessment creation and its two delivery attempts.
  `docs/persistence-boundary.md` explicitly defers rate limiting and CSRF protection.
- Risk: a caller who reaches the shared boundary can vary idempotency keys to consume database,
  Chromium, email, and provider capacity or cost.
- Required action: add audience-appropriate rate limits, cost quotas, anti-automation, origin/CSRF
  controls, and durable bounded work queues before customer exposure.
- Release impact: blocker; OWASP A04, ASVS V11/V13.

### SEC-242-004 - Personal-data lifecycle and disclosure controls are incomplete

- Severity: **High**
- Status: Open
- Evidence: the form says only that Royal Glass will save details and the preliminary assessment
  for follow-up. It does not disclose Resend/ServiceM8 forwarding, processors/regions, retention,
  access/correction, or deletion. `docs/persistence-boundary.md` retains rows until a future
  archive/delete workflow; no executable retention, deletion, access, or correction path exists.
- Risk: contact data, precise property geometry/imagery, and construction intent are stored and
  disclosed without complete code-verifiable NZ Privacy controls or a bounded lifecycle.
- Required action: implement the P0 privacy work in `gap-report.md` and complete the separate
  organisational/legal privacy process.
- Release impact: blocker; NZ Privacy IPP3/5/6/7/8/9/11/12, OWASP A02/A04, ASVS V6/V8/V9.

### SEC-242-005 - Strict E2E and immutable-state evidence are unavailable

- Severity: **High**
- Status: Open / blocked evidence
- Evidence: 14 required rows exist in `e2e-matrix.md`, none has a real-boundary implementation.
  Two diagnostic Playwright tests now pass with mocked assessment APIs, and a cleanup-backed
  delivery-store integration test passes against the migrated shared development database. No
  isolated database/fake email harness is configured, and the feature exists in a mixed uncommitted
  worktree.
- Risk: real authorization, persistence, idempotency, delivery, leakage, and privacy behavior is
  unproven, and results cannot be tied to an immutable candidate.
- Required action: create disposable database/email infrastructure, implement the matrix, run a
  production build with zero retries, validate the evidence, and bind it to the exact commit.
- Release impact: blocker; Secure SDLC strict E2E gate.

### SEC-242-006 - Security logging and deployment hardening are incomplete

- Severity: **Medium**
- Status: Open
- Evidence: delivery failure logs use safe reference/correlation fields, but no complete audit
  event path covers auth denials, validation/abuse rejection, staff record reads, assessment
  creation, or privacy breach scoping. No deployed TLS/HSTS evidence or explicit CSP, frame,
  referrer, or permissions policy exists.
- Risk: misuse and breach scope may not be detected; a future deployment can inherit unsafe
  defaults.
- Required action: add privacy-safe audit events/alerts and explicit production header/transport
  evidence.
- Release impact: required before deployment; OWASP A05/A09, ASVS V7/V9/V14, NZ Privacy IPP5.

## OWASP Top 10:2021

| Category                                       | Result                | Evidence                                                                                 |
| ---------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------- |
| A01 Broken Access Control                      | FAIL                  | Production identity/object controls and real arbitrary-object tests are absent           |
| A02 Cryptographic Failures                     | BLOCKED               | Server-only secrets are positive; deployed TLS and PII at-rest/processor evidence absent |
| A03 Injection                                  | PASS with blocked E2E | Positive schemas, escaping, parameterized DB, allow-listed fetches, isolated renderer    |
| A04 Insecure Design                            | FAIL                  | Client-authoritative report, missing abuse/lifecycle controls                            |
| A05 Security Misconfiguration                  | FAIL                  | Development-only boundary, hardening headers/deployment evidence absent                  |
| A06 Vulnerable and Outdated Components         | BLOCKED               | Affected Next.js range remediated locally; fresh production audit was not authorised     |
| A07 Identification and Authentication Failures | FAIL for release      | Shared Basic development boundary; no production identity or lockout model               |
| A08 Software and Data Integrity Failures       | FAIL                  | Forged browser aggregate can become the saved/emailed report                             |
| A09 Security Logging and Monitoring Failures   | FAIL                  | Incomplete security/privacy audit trail and alerts                                       |
| A10 SSRF                                       | PASS by code review   | Provider allow-list, fixed Resend URL, PNG-only map, Chromium network abort              |

## OWASP ASVS 4.0 Level 2 condensed review

| Chapter                               | Result                                          | Evidence                                                                                |
| ------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| V1 Architecture                       | FAIL                                            | Trust boundaries documented, but untrusted report facts cross directly into persistence |
| V2 Authentication                     | FAIL for release                                | Shared Basic development credential; no production identity/MFA/lockout                 |
| V3 Session Management                 | N/A only for current Basic development boundary | No application session exists; production design remains required                       |
| V4 Access Control                     | FAIL                                            | No production object-level policy or real object-level E2E                              |
| V5 Validation, Sanitization, Encoding | FAIL                                            | Shape/encoding strong, semantic authenticity of report/evidence fails                   |
| V6 Stored Cryptography                | BLOCKED                                         | Secret env boundary exists; PII at-rest/processor key evidence absent                   |
| V7 Error Handling and Logging         | FAIL                                            | Incomplete security audit trail; unexpected DB/config error path unproven               |
| V8 Data Protection                    | FAIL                                            | Retention/deletion/access/correction and leakage E2E absent                             |
| V9 Communications                     | BLOCKED                                         | No deployed TLS/HSTS or processor-region evidence                                       |
| V10 Malicious Code                    | BLOCKED                                         | Next.js remediation is local; fresh production audit was not authorised                 |
| V11 Business Logic                    | FAIL                                            | Forgery and unique-key abuse not prevented                                              |
| V12 Files and Resources               | PASS with blocked E2E                           | Strict bounded PNG and safe PDF serving                                                 |
| V13 API and Web Service               | FAIL                                            | Semantic validation, rate limiting, and strict authorization E2E absent                 |
| V14 Configuration                     | FAIL                                            | Development-only boundary and explicit production hardening incomplete                  |

## API and database review

- `POST /api/internal/assessments`: FAIL semantic integrity, abuse control, CSRF/origin, and
  server-established consent; PASS body/schema/image bounds and safe declared response shape.
- `GET /api/internal/assessments` and `GET /:id`: FAIL for release because the shared
  development-only boundary is not an object-level production policy; PASS `no-store`.
- `GET /:id/report`: PASS UUID format, `no-store`, `nosniff`, saved-only rendering, and safe error
  intent; real authorization and arbitrary-ID evidence blocked.
- Database: PASS parameterization, constraints, idempotency, and claim-token updates; FAIL
  retention/delete and client-authored fact integrity; least-privilege/encryption configuration
  blocked.

## NZ Privacy Act 2020 code-verifiable controls

| Principle/control             | Result                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------ |
| IPP1 purpose / IPP2 source    | PARTIAL PASS - pool enquiry purpose and direct collection                      |
| IPP3 awareness / IPP4 manner  | FAIL - processor, forwarding, retention, and rights notice incomplete          |
| IPP5 security                 | FAIL/BLOCKED - no release authorization; at-rest and leakage evidence absent   |
| IPP6 access / IPP7 correction | FAIL - no path                                                                 |
| IPP8 accuracy                 | FAIL - untrusted client controls assessment and consent facts                  |
| IPP9 retention                | FAIL - no period or executable deletion                                        |
| IPP10 use limitation          | BLOCKED - intended purpose documented, enforceable operational evidence absent |
| IPP11 disclosure              | FAIL - ServiceM8/Resend disclosure not included in consent notice              |
| IPP12 cross-border            | BLOCKED - processor locations and safeguards undocumented                      |
| IPP13 unique identifiers      | PARTIAL PASS - feature-scoped assessment reference                             |
| Breach readiness              | BLOCKED - incomplete security audit/breach-scoping evidence                    |

This is not a legal certification. Organisational privacy officer, complaints, breach notification,
contract, and processor due-diligence obligations require separate human/legal completion.

## Verification summary

- Current focused route tests: PASS, 14/14.
- Typecheck: PASS after the upgrade.
- ESLint: PASS using the existing installed `eslint-config-next` 16.2.10. The manifest and both
  lockfiles pin 16.2.12, but local alignment is blocked because npm's offline cache lacks that
  tarball; this does not affect the already-installed Next.js 16.2.12 production runtime.
- Production build: PASS after the upgrade (Next.js 16.2.12).
- Production proxy smoke: PASS for anonymous/wrong Basic denial and valid-Basic route reachability.
- Formatter: FAIL, 34 files in the mixed worktree.
- Strict E2E: BLOCKED, 2 diagnostic browser tests passed but 0/14 required security rows exist.
- Production dependency audit recheck: BLOCKED. The 2026-07-30 npm advisory query was again denied
  because it would send dependency metadata externally; the 2026-07-29 audit remains historical only.
- Secrets/path scan and `NEXT_PUBLIC_` scan: PASS within bounded repository scope.
- E2E evidence validator: PASS for structural validity; strict E2E remains BLOCKED at 0/14 required
  rows; see `e2e-results.json`.

## Release judgment

MT-242 is **not ready for merge or release on security evidence**. Observed High findings make the
verdict FAIL even before considering the blocked strict E2E gate. The positive tests and build
validate bounded implementation mechanics only; they do not authorize production/customer data,
deployment, migration, commit, or Linear closeout.
