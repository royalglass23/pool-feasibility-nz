# Release readiness and evidence map

This page tells a reviewer what is currently known. It does not grant deployment,
database-migration, credential, external-email, or production-test authority.

## Current position

The codebase contains a deployment-shaped Auckland Property Check with
anonymous public routes, persisted assessments, emailed PDFs, Admin-only saved
records, shared rate limiting, retention, consent-gated analytics, and public
contact/partnership forms.

The old July 2026 decision that described an internal, no-database,
session-scoped POC is superseded as a product description. Its test results
remain historical evidence only.

A candidate based on shared commit `6f97d6c` passed the complete local code gate
below on 11 September 2026, including the dedicated public-input safety lane.
The documentation refresh that followed passed repository formatting and
relative-link checks. This remains development evidence rather than an exact
deployed-revision sign-off.

Latest local candidate results:

| Gate                                         | Result                                                                                               |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| npm install, typecheck, lint, and formatting | PASS; lint reported four warnings and no errors                                                      |
| Vitest                                       | PASS; 608 passed and two predefined tests skipped                                                    |
| General Playwright E2E                       | PASS; 15 passed, zero retries                                                                        |
| Contact/partnership Playwright E2E           | PASS; eight passed, zero retries                                                                     |
| Production build                             | PASS                                                                                                 |
| npm and pnpm production audits               | PASS; zero known production vulnerabilities                                                          |
| Frozen pnpm install                          | PASS                                                                                                 |
| Public-input safety E2E                      | PASS; 22 passed across the database-disabled and authorised development-database modes, zero retries |

One synthetic idempotent assessment was written to the approved development
database by the security persistence lane. No production database or real email
delivery was used by this local rerun.

The overall release position remains **BLOCKED**. Re-run or bind the evidence to
the exact commit selected for promotion and complete the target checks below.
Follow [`testing.md`](testing.md) for lane isolation and
[`deployment-runbook.md`](deployment-runbook.md) for the target procedure.

## Required code gates

Run from a clean checkout of the exact candidate commit:

```powershell
npm install
npm run typecheck
npm run lint
npm run format:check
npm test -- --pool=threads --maxWorkers=1 --configLoader=runner
npm run test:e2e
npm run test:e2e:contact
npm run build
npm audit --omit=dev --audit-level=high
pnpm audit --prod --audit-level high
pnpm install --frozen-lockfile --ignore-scripts
```

Run the public-input safety suite separately as documented in
[`testing.md`](testing.md). A passing focused test is evidence for that slice,
not a waiver for a failed or missing full gate.

## Required target checks

Before calling a public deployment ready, verify all of the following on the
actual target:

- the deployed revision matches the reviewed commit;
- the production database schema and address index were applied to the approved
  database, with no test or preview binding;
- LINZ/Auckland Council credentials work and remain server-only;
- Upstash-backed public limits fail closed and run before costly or persistent
  work;
- report signing, Chromium rendering, Resend sender identity, homeowner report
  delivery, and the bounded support copy work without duplicate sends;
- Admin sign-in, lockout, session expiry, sign-out, saved-record access, and
  anonymous denial work against the production-shaped environment;
- retention and privacy-request operations target only authorised records;
- consent rejection leaves analytics unloaded and analytics payloads contain no
  address, contact, map, report, or staff data;
- headers, TLS, origin/host handling, indexing state, and the final public
  hostname match the intended launch; and
- an actual browser completes the address, placement, detailed-check, report,
  and recovery journeys on the deployed site.

Live-provider and delivery checks are operational evidence and must not be
converted into ordinary CI fixtures or run with production/customer data unless
that exact use is authorised.

## Evidence locations

Security evidence packs are intentionally ignored by repository policy and may
exist only in an authorised reviewer's local checkout. The paths below identify
the expected local records; they are not durable links in Git.

| Area                           | Expected local record                                            |
| ------------------------------ | ---------------------------------------------------------------- |
| Current dependency remediation | `security/dependency-remediation/signoff.md`                     |
| Public-input safety            | `security/public-input-safety/signoff.md`                        |
| Public input validation        | `security/report-input-validation/signoff.md`                    |
| Input-remediation review       | `security/report-input-validation/review/remediation-results.md` |
| Public lead-capture history    | `security/public-lead-capture/signoff.md`                        |
| Report-delivery history        | `security/production-report-delivery/signoff.md`                 |
| Traffic-launch history         | `security/mt-260/signoff.md`                                     |

Older FAIL/BLOCKED evidence is not automatically a claim that the current code
still has every recorded defect. It does prove that the named candidate was not
approved at that time. A later implementation or focused PASS does not replace
the need for an exact-commit, target-specific release decision.

## Historical internal POC result

The July candidate passed TypeScript, ESLint, Prettier, 124 Vitest tests, nine
controlled Chromium journeys, a production build, and live layer/aerial checks
for two Auckland fixtures on 20-21 July 2026. That result applied only to the
then-current internal, no-database POC and authorised neither external use nor
deployment. It is retained here to explain project history, not current
readiness.
