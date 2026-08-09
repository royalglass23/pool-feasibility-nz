# Security tests - MT-260 traffic launch

- Reviewed commit: `ebed3ef5f61db2bd5bb7a9450145f2d099446f92`
- Date: `2026-08-10` (Pacific/Auckland)

| Check                           | Result                                          | Evidence                                                                                                                                          |
| ------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public/Admin route policy       | PASS at focused unit boundary                   | Public adapters remain anonymous; Staff pages/APIs/reports deny without a session.                                                                |
| Admin lockout/session contract  | PASS at focused unit boundary                   | Five-failure lockout, fresh post-lock window, HttpOnly SameSite cookie, eight-hour maximum, safe redirect, and authenticated reads.               |
| Public rate-limit policy        | PASS at focused unit boundary                   | 10/11 and 3/4 limits, reset windows, per-IP/action separation, production fail-closed, managed-store timeout, and privacy-safe logs.              |
| Delivery data minimization      | PASS at focused unit boundary                   | Homeowner-only PDF, allowlisted ServiceM8 notification, separate retry/idempotency, HTML encoding.                                                |
| Retention lifecycle             | PASS at focused unit boundary                   | 12-month eligibility, active-delivery exclusion, transactional PII-free audit, repeat execution, cron authorization.                              |
| Privacy notice                  | PASS at focused unit boundary                   | Notice placement, purpose, processors, 12 months, support channel, and no implied marketing consent.                                              |
| Consent-gated analytics         | PASS at focused unit/browser-component boundary | GA absent before consent, reversible choice, disabled-without-ID, event allowlist, extra-field rejection.                                         |
| Targeted lint                   | PASS                                            | `npx.cmd eslint` over launch-control modules and their focused tests.                                                                             |
| TypeScript                      | PASS                                            | `npm.cmd run typecheck`.                                                                                                                          |
| Production build                | PASS                                            | `npm.cmd run build`; Next.js 16.2.12 production build completed.                                                                                  |
| Full Vitest suite               | FAIL                                            | 357 passed, 7 failed, 2 skipped. Renderer timeout/busy failures (5), empty-layer expectation (1), PDF-button expectation (1).                     |
| Repository format check         | FAIL (pre-existing broad baseline)              | `npm.cmd run format:check` reported 67 files, including source, docs, generated metadata, vendored assets, and the user-owned lockfile.           |
| Full ESLint                     | BLOCKED                                         | `npm.cmd run lint` produced no result for more than three minutes and was terminated; targeted lint passed.                                       |
| Production dependency audit     | BLOCKED                                         | Sandboxed npm registry request failed; escalation was rejected pending explicit approval to disclose dependency metadata to `registry.npmjs.org`. |
| Strict isolated Playwright lane | BLOCKED                                         | No executable MT-260 spec or isolated database/Admin/Upstash/delivery fixtures.                                                                   |

## Focused command evidence

- Initial `npm.cmd test -- ...` failed before discovery with Vite temp-file `EPERM`.
- One direct runner diagnostic passed 1 file / 2 tests.
- Four bounded direct-runner groups passed 16 files / 63 tests.
- Aggregate focused result: 17 files / 65 tests passed; zero focused failures or skips.
- Full suite command: `node node_modules/vitest/vitest.mjs run --configLoader runner --pool=forks --maxWorkers=1 --reporter=default`.
