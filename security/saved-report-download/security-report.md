# Security report - saved report download and delivery

- Date: 2026-08-10
- Mode: retrofit
- Repository: `D:\Royal Glass Dev\geomap`
- Reviewed commit: `ea35f9c306fb2bef11ef4011c9883f3bdc51be0d`
- Candidate: uncommitted working tree
- Stack: Node.js, Next.js 16.2.12, React, Drizzle/Neon, Playwright
- Compliance: code-verifiable NZ Privacy Act 2020 controls
- Target: local/test only; no production or external delivery action authorised
- Verdict: **FAIL**

## Scope and architecture judgment

The new public PDF and delivery routes replace the staff-only download path with a short-lived HMAC capability bound to one assessment UUID/reference. Verification occurs before database access; the loaded reference must match; requests are byte-bounded and strict-schema validated; responses are minimized and non-cacheable. Delivery claims and provider idempotency keys provide a sound ordinary duplicate-send boundary. Reporting now consumes static aerial pixels and report-eligible geometry rather than calling providers from the reporting module.

Release remains unsafe. The production dependency tree contains high advisories; the delivery design conflicts with the unresolved ServiceM8 privacy gate; anti-automation, distributed capability replay, browser headers and production configuration are unresolved; malformed Unicode signatures and active-scheme URLs fail validation expectations; and strict real-boundary E2E evidence is absent.

## Highest findings

See `gap-report.md` for the full remediation ledger.

- **SEC-SRD-001 High:** `npm audit --omit=dev --json` reports three high and one moderate production advisories. Next 16.3.0 is the offered fix for the vulnerable Next subtree.
- **SEC-SRD-002 High:** ServiceM8 forwarding would transmit name, phone, email, address and visitor context although the current privacy runbook requires forwarding to remain disabled pending irreversible-retention evidence.
- **SEC-SRD-003 High:** production configuration and real provider outcomes are unverified; local environment names lack `RESEND_API_KEY`, `REPORT_FROM_EMAIL` and `SERVICEM8_FORWARD_EMAIL`.
- **SEC-SRD-004 High:** a caller can submit another person's contact details and cause unsolicited delivery/false leads without mailbox ownership or an equivalent approved abuse control.
- **SEC-SRD-005 High:** IP-only rate limits do not bound distributed replay of one leaked capability against the single-slot PDF renderer.
- **SEC-SRD-006 Medium:** a 43-character multibyte signature creates unequal byte buffers in `timingSafeEqual`; reproduced result is `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH`, returned by routes as generic 502 instead of uniform 401.
- **SEC-SRD-009 Medium:** current Zod URL validation accepts `javascript:` and `data:` and these values can be rendered as report attribution links.
- **SEC-SRD-010 Blocking evidence:** the strict Playwright matrix is 0/12 and the candidate is not an immutable commit.
- **SEC-SRD-011 Blocking evidence:** the current IPP3A indirect-collection duties have not been explicitly assessed for provider-derived property/person data or submissions made by representatives/other people.

## E2E and test evidence

- Focused Vitest: 5 files, 33 tests passed.
- Typecheck: passed.
- ESLint: zero errors, one vendored warning.
- Production build: passed under Next 16.2.12.
- Diagnostic Playwright: 1 Chromium test passed, one worker, zero retries; assessment, delivery and PDF routes were mocked.
- Strict E2E: **BLOCKED**, 0 of 12 required rows covered. See `e2e-matrix.md`, `e2e-results.json` and `e2e-results.md`.
- Evidence validator: structurally valid `BLOCKED`; expected non-zero exit because the gate is not PASS.

## OWASP Top 10:2021

| Category                                       | Result                                  | Evidence                                                                     |
| ---------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------- |
| A01 Broken Access Control                      | PASS at code/unit boundary; E2E BLOCKED | HMAC UUID/reference binding and post-load reference match                    |
| A02 Cryptographic Failures                     | FAIL                                    | Capability replay/scope and production privacy/transport evidence unresolved |
| A03 Injection                                  | FAIL                                    | Active-scheme URL acceptance; DB access is parameterized                     |
| A04 Insecure Design                            | FAIL                                    | Spoofed-contact abuse and distributed cost boundary unresolved               |
| A05 Security Misconfiguration                  | FAIL                                    | Security headers and production configuration not verified                   |
| A06 Vulnerable and Outdated Components         | FAIL                                    | 3 high + 1 moderate production advisories                                    |
| A07 Identification and Authentication Failures | FAIL                                    | Unicode signature error; no action-scoped token or ownership control         |
| A08 Software and Data Integrity Failures       | BLOCKED                                 | Immutable candidate and CI/evidence enforcement absent                       |
| A09 Logging and Monitoring Failures            | BLOCKED                                 | Safe limiter log shape exists; real log/alert evidence absent                |
| A10 SSRF                                       | PASS at code boundary                   | Fixed LINZ host/tile coordinates and renderer request abort                  |

## OWASP ASVS 4.0 Level 2

| Chapter                         | Result                                  | Evidence                                                                           |
| ------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------- |
| V1 Architecture                 | PASS as inventory                       | Requirements, data classification and threat model                                 |
| V2 Authentication / V3 Session  | N/A with scope reason                   | Capability route has no user account/session; token controls assessed under V4/V13 |
| V4 Access Control               | PASS at code/unit boundary; E2E BLOCKED | Signed object binding and archived-row exclusion                                   |
| V5 Validation / encoding        | FAIL                                    | Unicode signature and active-scheme URL gaps                                       |
| V6 Stored cryptography          | PASS in bounded code scan               | HMAC secret is server-only; no secret values committed                             |
| V7 Errors / logging             | BLOCKED                                 | Generic errors and minimized limiter logs; runtime inspection missing              |
| V8 Data protection              | FAIL/BLOCKED                            | ServiceM8/IPP12 evidence and capability replay unresolved                          |
| V9 Communications               | BLOCKED                                 | Production TLS/HSTS not verified                                                   |
| V10 Malicious code/dependencies | FAIL                                    | High production advisories                                                         |
| V11 Business logic              | FAIL                                    | Contact spoofing and distributed replay controls unresolved                        |
| V12 Files/resources             | PASS at code/unit boundary              | Validated PNG, generated attachment PDF, no public upload                          |
| V13 API/web service             | FAIL/BLOCKED                            | Strong local schema/limits; strict real-boundary proof absent                      |
| V14 Configuration               | FAIL/BLOCKED                            | Delivery/provider configuration and security headers unverified                    |

## API, database, logging and secrets

- API positive controls: strict one-field schemas, 16 KB byte limit, generic `no-store` errors, safe PDF headers/filename and minimized delivery response.
- Authorization positive controls: signed UUID/reference, verification before lookup, post-load reference match and archived-row exclusion.
- Database positive controls: Drizzle predicates/SQL parameterization, atomic delivery claim transitions, idempotency and 12-month deletion query.
- Abuse controls: production Upstash and trusted Vercel IP fail closed, but limits are IP-only and real multi-instance behavior is untested.
- Logging: limiter events omit IP, token, PII and report content; distributed-replay alerts and real evidence capture are absent.
- Secrets: `.env*` is ignored and only `.env.example` is tracked. Secret values were not inspected or emitted. Production secret presence was not verified.

## NZ Privacy Act 2020 code-verifiable controls

- IPP1-4: purpose, direct collection, notice and consent path are present; the false-contact abuse case remains.
- IPP3A: [current OPC guidance](https://www.privacy.org.nz/resources-and-learning/a-z-topics/ipp3a/) says indirect collectors must notify the individual unless an exception applies and identifies the required notice matters. Applicability to provider-derived property/person data and submissions by another person has not been decided or evidenced.
- IPP5: access binding, environment-secret design and minimized logs are positive; dependency/header/runtime evidence fails or is blocked.
- IPP6-8: documented verified access/correction process and validated submission model exist.
- IPP9: Neon 12-month deletion exists and Resend 30-day evidence is recorded; ServiceM8 irreversible deletion is unproven, so forwarding must remain disabled.
- IPP10-11: privacy notice limits use/disclosure to report delivery and follow-up; ServiceM8 receives a minimized notification only when enabled.
- IPP12: whether each overseas service is an agent-only processor or needs comparable-safeguard evidence is an external legal/contract determination not proven here; production enablement remains blocked pending that record. See the [current OPC principle](https://www.privacy.org.nz/privacy-principles/12/).
- IPP13: UUID/reference identifiers are feature-scoped and capability-protected.
- Breach readiness: a manual escalation process exists, but runtime detection/alert evidence is missing.

The Office of the Privacy Commissioner notes that IPP12 may not apply to an overseas agent used only for storage/processing, while comparable safeguards or informed authorisation are required for applicable foreign disclosures. This audit does not make that legal/contract determination.

## Final judgment

This retrofit is **FAIL** for release. Local regression/build evidence is useful, but high dependency, privacy, abuse and availability findings are open, two deterministic validation defects are reproduced, strict E2E is blocked, and the candidate is uncommitted. No commit, push, deployment, production configuration, database mutation or external send is authorised by this report.
