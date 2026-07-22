# Historical baseline security report - expandable-assessment-pdf

> Historical evidence only. Findings below apply to commit `e47f4e6` before remediation and are retained for audit history.

- Stack: Node/Next.js 16.2.10 (`marker:package.json`)
- Mode: retrofit
- Date: 2026-07-22 (Pacific/Auckland)
- Reviewed commit: `e47f4e6fd28a6ca4249f5d1a189c32ba6ad06933`
- Target: internal/local Auckland-only POC; external/customer release and deployment remain out of scope
- Overall verdict: **FAIL**

## Executive finding

The feature correctly fails closed for anonymous/wrong credentials, bounds the raw request, emits safe generic errors, escapes ordinary assessment text, returns a no-store/nosniff PDF, closes Chromium in `finally`, performs no PDF-time GIS calls, and produces exactly three pages. Those controls are insufficient for sign-off.

Four required production-boundary abuse tests failed: attribute-injection-shaped map input, caller-tampered report facts, unbounded nested content, and concurrent Chromium rendering. A separate code/data-governance review found that the document includes licence-limited evidence and loses required map attribution. These are release blockers.

## Risk-ranked findings

### F-01 - High - Map data URL permits active HTML attribute injection

- Evidence: `parseSessionReportRequest` only checks `startsWith("data:image/png;base64,")` and character length. `renderSessionReportHtml` inserts `mapImageDataUrl` directly into a quoted `src` attribute without escaping or validating decoded PNG bytes.
- Reproduction: the security lane submitted `data:image/png;base64,x" onerror="...` and received `200` plus a PDF instead of `400`.
- Impact: script execution in the privileged renderer and possible server-side network requests/SSRF; renderer resource abuse.
- Required remediation: strict base64 decode, PNG signature/dimension/decoded-size validation, attribute escaping, renderer request interception/default-deny network policy, and a regression test proving no request leaves the renderer.

### F-02 - High - Server mints PDFs from caller-tampered assessment facts

- Evidence: `isSessionAssessment` validates only a handful of fields and the route accepts the client-retransmitted assessment as authoritative.
- Reproduction: changing the address and recommendation produced `200` and a PDF.
- Impact: misleading or fabricated preliminary reports, altered evidence classifications, and loss of report integrity.
- Required remediation: render from a server-verifiable immutable snapshot (signed canonical view model or short-lived server-side snapshot). Bind the map to the same verified assessment or explicitly redesign/watermark the artifact as untrusted client-authored content.

### F-03 - High - Nested report content is not deeply schema-bounded

- Evidence: arrays, strings, enums, dates, and numeric fields are not positively validated; the raw 6.5 MB request cap is the only broad limit.
- Reproduction: a 50 KB limitation field reached Chromium and returned `200`.
- Impact: excessive HTML/layout work, unexpected exceptions, clipped/misleading content, and a multiplier on renderer DoS.
- Required remediation: a strict Zod schema with per-field lengths, per-array counts, enums, finite numeric ranges, ISO timestamps, exact object keys, and total decoded-map bounds; reject before HTML generation.

### F-04 - High - Chromium rendering has no timeout, concurrency cap, or busy response

- Evidence: every accepted request launches a new Chromium process; there is no semaphore, bounded queue, deadline, rate limit, or per-identity abuse control.
- Reproduction: two concurrent requests both returned `200`; no `REPORT_RENDERER_BUSY` response existed.
- Impact: authenticated or credential-stuffing attacker can exhaust CPU/memory and destabilize the whole Next.js process, exposing all in-process server credentials if compromise follows.
- Required remediation: bounded renderer pool/semaphore, short bounded queue or explicit 429, hard render/browser timeout with process cleanup, per-identity/IP throttling, and load/concurrency tests.

### F-05 - High - PDF violates evidence-use and attribution gates

- Evidence: the report renders the first six provenance records without filtering `evidenceUse`; controlled output includes Auckland Council `spike_only` layers. The map PNG is created from the WebGL canvas only, while MapLibre attribution controls and evidence-use labels are DOM elements and are not captured. Enabled Watercare `internal_reference` layers can enter the canvas image.
- Impact: licence/redistribution breach, loss of source attribution, and presentation of non-report evidence as report content.
- Required remediation: filter document evidence to `report_allowed`; exclude `spike_only` and `internal_reference` layers from report imagery; pass and render human-readable attribution/licence text separately; test the exact PDF model and print output.

### F-06 - Medium - PDF security events are not logged

- Evidence: the route returns correlation IDs but records no authenticated outcome, rejection reason category, renderer-busy/timeout, or duration event.
- Impact: poor abuse detection, incident scoping, and repudiation resistance.
- Required remediation: structured outcome-only logging with correlation ID, actor identifier hash or safe internal principal, status category, and duration; never log address, map, credentials, or report content.

### F-07 - Medium - Authentication and deployment hardening are POC-only

- Evidence: one shared Basic-auth role, no lockout/rate limit/MFA, no app-level HSTS/CSP/frame/referrer/permissions headers, and development bypass trusts the request URL hostname.
- Impact: unsuitable for external/customer deployment; credential replay and exposed development servers would broaden access.
- Required remediation: retain local-only binding for development; require TLS and an identity-aware access layer for deployment; add abuse controls and hardened headers. This does not block the explicitly local/internal POC by itself but blocks deployment.

### F-08 - Moderate - Development tool dependency advisories

- Evidence: live `npm audit` reported 7 moderate findings under `drizzle-kit`/nested `esbuild` and `shadcn`/MCP/Hono paths. `npm audit --omit=dev` reported zero production vulnerabilities.
- Impact: developer-machine/tooling exposure, not shipped PDF runtime exposure.
- Required remediation: review/upgrade or remove unused tooling without accepting the registry's suggested unsafe major downgrade blindly.

## Architecture and implementation review

| Area                      | Result  | Evidence                                                                                   |
| ------------------------- | ------- | ------------------------------------------------------------------------------------------ |
| Thin delivery adapter     | PASS    | Route delegates auth, body reading, parsing, and renderer functions                        |
| Authorization seam        | PARTIAL | Route and proxy enforce shared Basic auth; no roles/tenants; local development bypass only |
| Data access during PDF    | PASS    | No provider or database call in reporting module                                           |
| Failure isolation         | FAIL    | Browser closes in `finally`, but no timeout/concurrency/queue isolation                    |
| Input/output validation   | FAIL    | Raw body bounded and text escaped, but shallow model and fake-PNG validation               |
| Report integrity          | FAIL    | Client snapshot/map not server-verifiable                                                  |
| Observability             | FAIL    | Correlation response exists; no report security outcome logging                            |
| Scalability/availability  | FAIL    | One Chromium process per accepted request with no bound                                    |
| Evidence/licence handling | FAIL    | `spike_only` data and unattributed canvas can enter the report                             |
| Persistence/retention     | PASS    | No report database/blob/cache write; responses are no-store                                |

## OWASP Top 10:2021

| Category                                       | Result                         | Evidence                                                                                                   |
| ---------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| A01 Broken Access Control                      | PASS for local POC             | Direct anonymous/wrong credential tests return 401; no object/tenant model exists                          |
| A02 Cryptographic Failures                     | PARTIAL                        | Secrets stay server-side and report is no-store; transport security is an external deployment prerequisite |
| A03 Injection                                  | **FAIL**                       | F-01 active map attribute injection reaches renderer                                                       |
| A04 Insecure Design                            | **FAIL**                       | No report-integrity or renderer-abuse design control                                                       |
| A05 Security Misconfiguration                  | PARTIAL                        | Safe errors/nosniff; broader hardened headers absent                                                       |
| A06 Vulnerable and Outdated Components         | PASS runtime / backlog tooling | Production-only audit: zero; full audit: seven moderate dev/tool findings                                  |
| A07 Identification and Authentication Failures | PARTIAL                        | Constant-time shared Basic credentials; no rate limit/MFA/individual accountability                        |
| A08 Software and Data Integrity Failures       | **FAIL**                       | Caller controls the supposedly authoritative report snapshot                                               |
| A09 Security Logging and Monitoring Failures   | **FAIL**                       | No report security outcome/audit logging                                                                   |
| A10 SSRF                                       | **FAIL**                       | Renderer receives injectable active HTML and has no network default-deny policy                            |

## OWASP ASVS 4.0 Level 2 condensed review

| Chapter                                  | Result                             | Evidence                                                                             |
| ---------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------ |
| V1 Architecture                          | PASS                               | Requirements, classification, and threat boundaries documented                       |
| V2 Authentication                        | PARTIAL                            | Env-managed credentials, minimum password length; shared Basic auth only             |
| V3 Session Management                    | N/A                                | No cookie/session/token model; Basic auth used                                       |
| V4 Access Control                        | PASS for current single-role scope | Server-side deny demonstrated; no objects/tenants                                    |
| V5 Validation, Sanitization and Encoding | **FAIL**                           | F-01 and F-03                                                                        |
| V6 Stored Cryptography                   | N/A                                | No stored report/credential database in feature                                      |
| V7 Error Handling and Logging            | **FAIL**                           | Safe errors pass; security logging absent                                            |
| V8 Data Protection                       | PARTIAL                            | Session-only/no-store; integrity and attribution defects remain                      |
| V9 Communications                        | BLOCKED for deployment             | TLS is not configured/proved by this local app evidence                              |
| V10 Malicious Code                       | PASS runtime / backlog tooling     | Production audit zero; dev advisories recorded                                       |
| V11 Business Logic                       | **FAIL**                           | No anti-automation/concurrency control for expensive rendering                       |
| V12 Files and Resources                  | **FAIL**                           | Fake PNG accepted without decoded type/signature/dimension checks                    |
| V13 API and Web Service                  | **FAIL**                           | Auth passes; schema validation and rate limiting fail                                |
| V14 Configuration                        | PARTIAL                            | Server-only secrets and production build pass; hardened deployment config not proved |

## API security review

| Check               | Result                   | Evidence                                                                         |
| ------------------- | ------------------------ | -------------------------------------------------------------------------------- |
| Authentication      | PASS                     | Proxy and route checks; production-boundary 401 tests                            |
| Authorization       | PASS within one-role POC | No resource/owner/tenant identifier or persistence exists                        |
| Input validation    | **FAIL**                 | F-01/F-03; prefix-only image and shallow assessment check                        |
| Output encoding     | PARTIAL                  | Assessment strings escaped; map attribute is not                                 |
| Rate limiting/abuse | **FAIL**                 | F-04                                                                             |
| Methods/CORS        | PASS/PARTIAL             | Only POST exported; no permissive CORS observed; origin/CSRF policy not explicit |
| Errors              | PASS                     | Stable safe JSON, correlation ID, no stack/input reflection in tested failure    |

## Logging, secrets, and data retention

- Secret scan found no committed private key/token pattern; `.env.example` is the only tracked environment file.
- The only broader secret-pattern match was an intentional test error string used to prove redaction.
- PDF route logs no request content or secrets, but also provides no security event trail.
- Generated PDFs, map bytes, and assessments are not stored server-side; runtime Playwright failure traces contain only approved controlled fixture data and remain ignored test artifacts.

## NZ Privacy Act 2020 - code-verifiable slice

| Principle/control               | Result                    | Evidence                                                                            |
| ------------------------------- | ------------------------- | ----------------------------------------------------------------------------------- |
| IPP1 Purpose/minimisation       | PASS for POC              | Property assessment purpose is narrow; report omits raw provider payloads/geometry  |
| IPP2 Source                     | PARTIAL                   | Official public property sources; not collected directly from an individual         |
| IPP3 Awareness                  | **FAIL for external use** | No individual-facing collection/privacy notice; internal tool only                  |
| IPP4 Fair manner                | PASS for internal scope   | No dark pattern; explicit limitations                                               |
| IPP5 Security                   | **FAIL**                  | Renderer injection, integrity, and DoS defects                                      |
| IPP6/IPP7 Access and correction | N/A/PARTIAL               | No durable personal record; staff can rerun but no individual request workflow      |
| IPP8 Accuracy                   | PARTIAL                   | Deterministic provenance and limitations, but client can alter report facts         |
| IPP9 Retention                  | PASS                      | Session-only and no-store; no report history                                        |
| IPP10/IPP11 Use/disclosure      | PARTIAL                   | Internal purpose documented; downloaded PDF handling is user-controlled             |
| IPP12 Cross-border              | BLOCKED                   | Renderer is local, but future deployment/provider regions are not documented        |
| IPP13 Identifiers               | PASS                      | Existing LINZ IDs used for the stated assessment purpose; no new durable identifier |
| Breach readiness                | **FAIL**                  | No PDF security event logging or code-level detection/scoping path                  |

Human/legal privacy notices, complaints/access handling, breach notification operations, and third-party licensing approval require separate organisational review.

## Verification summary

- Production build: PASS.
- Strict zero-retry Chromium security lane: **FAIL**, 5 passed / 4 failed / 0 skipped / 0 flaky.
- E2E evidence validator: schema/current-commit validation succeeded but exited non-zero because verdict is FAIL, as required.
- Production dependency audit: PASS, zero vulnerabilities with dev dependencies omitted.
- Full dependency audit: backlog, seven moderate development-tool findings.

## Decision

**FAIL.** Do not treat the expandable assessment/PDF feature as ready for merge promotion, deployment, or external/customer report use. The local internal POC may remain available only with the existing release boundary and with PDF generation treated as unsafe until F-01 through F-05 are remediated and the strict lane is rerun from a committed revision.
