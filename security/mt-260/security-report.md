# Security report - MT-260 traffic launch

- Mode: retrofit release gate
- Repository: `D:\Royal Glass Dev\geomap`
- Reviewed commit: `ebed3ef5f61db2bd5bb7a9450145f2d099446f92`
- Target: isolated non-production production-build traffic-launch fixture
- Review date: `2026-08-10` (Pacific/Auckland)
- Stack: Node.js, Next.js 16.2.12, React 19, Drizzle/Neon, Upstash-compatible Redis, Playwright
- Verdict: **FAIL**

## Outcome

The launch-control implementation has materially improved since the stale `cc3f920` review. Focused code/unit evidence passes for public/Admin routing, Admin lockout/session configuration, rate-limit policies, delivery minimization, retention, privacy notice, and consent analytics. Typecheck, targeted lint, and the production build pass.

Public release evidence does not pass. The strict lane is BLOCKED with zero executable rows and no isolated fixtures. Separately, the one full suite run has seven failures and two skips, which makes the overall sign-off FAIL rather than merely BLOCKED. Independent review also found public costly adapters outside the shared abuse budget and unrelated/privacy-sensitive artifacts in the committed candidate range.

## Findings

| ID                       | Severity  | Result       | Evidence                                                                                                                                                          | Next action / release impact                                                                            |
| ------------------------ | --------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| SEC-MT260-001            | Blocking  | BLOCKED      | No named isolated database, Staff Admin, Upstash-compatible store, delivery capture, retention credential, or production-build Playwright harness.                | Provision and verify disposable targets with target-specific authorization; PASS impossible until then. |
| SEC-MT260-002            | Blocking  | BLOCKED      | Eight required E2E rows map to no executable `mt-260-security.spec.ts` tests.                                                                                     | Implement setup/teardown and strict lane after provisioning; one worker, zero retries.                  |
| SEC-MT260-003            | Blocking  | FAIL         | Full Vitest: 357 passed, 7 failed, 2 skipped. Five renderer timeout/busy failures and two behavior/test mismatches.                                               | Diagnose/remediate under a bounded follow-up, then rerun affected checks before another full lane.      |
| SEC-MT260-004            | Important | BLOCKED      | Production `npm audit` could not reach npm in sandbox; escalation was rejected pending explicit approval to disclose dependency metadata to `registry.npmjs.org`. | Obtain explicit destination approval, run once, and triage applicable advisories.                       |
| SEC-MT260-005            | Important | BLOCKED/FAIL | Targeted lint passes; full ESLint hung and was terminated; format check reports 67 broad baseline files.                                                          | Diagnose lint hang separately; do not mass-format unrelated/generated/vendor/user files in this ticket. |
| SEC-MT260-006 / STD-001  | Blocking  | FAIL         | Direct public PDF and provider adapters sit outside the documented shared rate-limit wrappers.                                                                    | Agree budgets and prevent unbounded work without double-charging autocomplete/property stages.          |
| SEC-MT260-007 / SPEC-005 | Blocking  | FAIL         | Reviewed range contains Playwright/server logs, address-specific Puhoi reports/images, prototype assets, and unrelated research.                                  | Privacy/licensing/scope review and explicit removal/separation authority are required.                  |
| SEC-MT260-008 / STD-003  | Minor     | OPEN         | Local and Upstash quotas duplicate literal limits/windows.                                                                                                        | Centralize when the approved abuse-budget remediation is implemented.                                   |

The complete independent review ledger is in [code-review.md](code-review.md).

## Architecture, API, database, logging, and secrets

- Authentication: salted scrypt password hashes, non-enumerating failures, five-failure lockout, server-side session storage, HttpOnly/SameSite cookie, eight-hour expiry, and sign-out invalidation are implemented and focused-tested. Real database/browser proof is missing.
- Authorization: Staff pages, APIs, and saved report routes check the Staff session. Anonymous forced-browsing and record-existence leakage are not proven in the strict environment.
- Validation/integrity: positive schemas, short-lived signed Property Check snapshots, server reconstruction, bounded responses, idempotency, parameterized Drizzle/SQL tags, and output encoding are positive controls.
- Database: reviewed migrations contain no credential values; password hashing and 12-month transactional deletion exist. Least-privilege, at-rest, real deletion, active-delivery exclusion, and target identity evidence are missing.
- Abuse: the primary Property Check, signed stages, and assessment routes use the shared limiter and production fails closed. Independent review found other anonymous provider/PDF paths outside that budget.
- Logging: rate-limit and retention events use action/outcome/correlation/run metadata without IP/contact/property payloads. No production log sink/alerting or strict leakage artifact exists.
- Secrets scan: evidence records key presence/state only and no secret values. Committed console/server logs contained PII-like terms but no secret-like token names in the bounded scan; exact contents still require privacy review.
- Destructive/external safety: no database migration/write, delivery, retention deletion, managed-store mutation, deployment, or production/customer action ran.

## OWASP Top 10:2021

| Category                                       | Result                     | Evidence                                                                                                 |
| ---------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------- |
| A01 Broken Access Control                      | BLOCKED                    | Server-side Staff checks pass locally; strict anonymous forced-browsing/IDOR proof missing.              |
| A02 Cryptographic Failures                     | BLOCKED                    | Password/session controls exist; TLS, at-rest, processor, and artifact leakage evidence missing.         |
| A03 Injection                                  | PASS at code/unit boundary | Positive schemas, parameterized queries, bounded errors, and output encoding.                            |
| A04 Insecure Design                            | FAIL                       | Direct costly public adapters bypass the documented shared abuse budget.                                 |
| A05 Security Misconfiguration                  | FAIL/BLOCKED               | Production build passes; route-budget gap, final origin/headers/TLS evidence, and full lint remain open. |
| A06 Vulnerable Components                      | BLOCKED                    | Current external dependency audit not authorized.                                                        |
| A07 Identification and Authentication Failures | BLOCKED                    | Strong local controls; real isolated account/session lifecycle not exercised.                            |
| A08 Software and Data Integrity Failures       | BLOCKED                    | Signed snapshots/idempotency are positive; real persistence/delivery evidence missing.                   |
| A09 Security Logging and Monitoring Failures   | BLOCKED                    | Privacy-safe events exist; production sink, alerting, and leakage capture missing.                       |
| A10 SSRF                                       | PASS at code boundary      | Fixed/validated provider adapters; no user-selected arbitrary host found.                                |

## OWASP ASVS 4.0 Level 2

| Chapter                                                         | Result                     | Evidence                                                                                |
| --------------------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------- |
| V1 Architecture                                                 | FAIL                       | Threat boundaries documented; abuse-budget and candidate-scope findings open.           |
| V2 Authentication / V3 Session                                  | BLOCKED                    | Code/unit controls pass; isolated lifecycle proof missing.                              |
| V4 Access Control                                               | BLOCKED                    | Server checks exist; direct route/API browser proof missing.                            |
| V5 Validation / Encoding                                        | PASS at code/unit boundary | Positive validation, encoding, and parameterized database access.                       |
| V6 Stored Cryptography / V8 Data Protection / V9 Communications | BLOCKED                    | Hashing/retention exist; at-rest/TLS/real privacy lifecycle proof missing.              |
| V7 Error Handling / Logging                                     | BLOCKED                    | Safe shapes/events are positive; production log evidence absent.                        |
| V10 Malicious Code                                              | BLOCKED                    | Dependency audit unavailable.                                                           |
| V11 Business Logic / V13 API                                    | FAIL                       | Some anonymous costly routes bypass the documented shared limiter; strict proof absent. |
| V12 Files / Resources                                           | BLOCKED                    | PDF/map bounds are code-tested; real artifact leakage and delivery capture absent.      |
| V14 Configuration                                               | BLOCKED                    | Production build passes; isolated deployment, origin, secrets, and headers not proven.  |

## NZ Privacy Act 2020 - code-verifiable controls only

| Principle                    | Result                        | Evidence                                                                                                                            |
| ---------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| IPP1/2 Purpose and source    | PASS at code boundary         | Visitor directly supplies data for report delivery/follow-up.                                                                       |
| IPP3/4 Awareness and manner  | PASS at code/content boundary | Public notice, processors, 12 months, support channel, and no-marketing distinction.                                                |
| IPP5 Security                | FAIL/BLOCKED                  | Staff controls exist, but strict leakage/access/at-rest evidence is missing and committed residential/log artifacts require review. |
| IPP6/7 Access and correction | PARTIAL                       | Manual `support@royalglass.co.nz` process is documented; no fixture exercise.                                                       |
| IPP8 Accuracy                | PASS at code boundary         | Checked address is server-derived from the signed snapshot; conditional details validated.                                          |
| IPP9 Retention               | BLOCKED                       | Deletion path passes unit tests; no disposable real-row execution.                                                                  |
| IPP10 Use limitation         | PASS at code boundary         | Report Delivery Consent is separated from marketing and analytics consent.                                                          |
| IPP11 Disclosure             | BLOCKED                       | Delivery allowlist passes unit tests; dedicated outbound capture missing.                                                           |
| IPP12 Cross-border           | BLOCKED                       | Processors are disclosed; runtime regions/safeguards are not evidenced here.                                                        |
| IPP13 Unique identifiers     | PASS at code boundary         | Feature references are not reused as authentication or external identity.                                                           |
| Breach readiness             | BLOCKED                       | No production log/alerting evidence or strict artifact scan.                                                                        |

This is not legal certification. Organisational privacy-officer, processor-contract, complaint, breach-notification, and cross-border adequacy work remains human/legal scope.

## Release judgment

**NO-GO.** The MT-260 overall verdict is FAIL. Strict E2E is independently BLOCKED, the full suite is red, and blocking review findings remain open. Do not publish traffic, enable production collection/delivery/analytics, run production retention, deploy, close Linear, or represent this as release readiness.
