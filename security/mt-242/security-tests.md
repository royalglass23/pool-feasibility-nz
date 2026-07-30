# Security tests - MT-242

## Executed checks

| Check                                                             | Command or evidence                                                    | Result                                                       |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------ |
| Focused assessment, staff, report, validation, and delivery tests | `npm.cmd test --` 11 named files                                       | PASS - 11 files, 38 tests                                    |
| TypeScript                                                        | `npm.cmd run typecheck`                                                | PASS                                                         |
| ESLint                                                            | `npm.cmd run lint`                                                     | PASS                                                         |
| Production build                                                  | `npm.cmd run build`                                                    | PASS - Next.js 16.2.10 build completed                       |
| Repository formatting                                             | `npm.cmd run format:check`                                             | FAIL - 34 files, including pre-existing/mixed worktree files |
| Strict E2E                                                        | See `e2e-results.md`                                                   | BLOCKED - web server setup timed out; 0 tests                |
| Production dependency audit                                       | `npm.cmd audit --json --omit=dev` on 2026-07-29                        | FAIL - 2 High vulnerabilities (`next`, `sharp`)              |
| Full dependency audit                                             | `npm.cmd audit --json` on 2026-07-29                                   | FAIL - 18 total: 12 High, 6 Moderate                         |
| Credential-pattern scan                                           | bounded `rg -l` scan excluding dependencies/generated reports/evidence | PASS - no potential secret paths                             |
| Client-exposed credential names                                   | `rg NEXT_PUBLIC_` across source/config/docs/tests                      | PASS - documentation only                                    |
| Diff whitespace                                                   | `git diff --check`                                                     | PASS                                                         |

## Threat and abuse-case results

| Case                                                                                                   | Result                            | Evidence                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------ | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Anonymous/non-loopback request is denied when internal access is unconfigured                          | PASS at unit boundary             | `tests/unit/internal-assessments-route.test.ts`; focused suite passed                                                                     |
| Staff handlers fail closed outside development/test                                                    | PASS at unit boundary             | `tests/unit/staff-development-boundary.test.ts`; focused suite passed                                                                     |
| Invalid shape, malformed geometry, invalid PNG, and contradictory non-empty warning state are rejected | PASS at unit boundary             | `tests/unit/persisted-assessment.test.ts`; focused suite passed                                                                           |
| Report/email HTML encodes homeowner and property text                                                  | PASS at unit/integration boundary | `assessment-report-delivery.test.ts`, `preliminary-report-renderer.test.ts`; focused suite passed                                         |
| SQL is parameterized                                                                                   | PASS by code review               | Drizzle query builder and tagged `sql` fragments in `homeowner-assessment-repository.ts`; no concatenated SQL found                       |
| PDF renderer fetches attacker-controlled resources                                                     | PASS by code review               | `report-renderer.ts` aborts all page routes; map input is bounded PNG data                                                                |
| Client forges a self-consistent report/evidence/warning/consent aggregate                              | **FAIL**                          | `POST` parses then saves the browser aggregate; schema checks shape and only compares each supplied warning to the supplied overall state |
| Expensive routes are throttled/quota-bound                                                             | **FAIL**                          | No assessment/provider/email rate limiter or per-principal quota; `docs/persistence-boundary.md` lists rate limiting as future work       |
| Consent time/version is server-authenticated                                                           | **FAIL**                          | `homeowner-submission-form.tsx` supplies both values; the route persists them                                                             |
| Production proxy cannot be bypassed                                                                    | **FAIL**                          | Current npm advisory GHSA-6gpp-xcg3-4w24 applies to installed Next.js 16.2.10                                                             |
| Real idempotency and delivery race behavior                                                            | BLOCKED                           | PostgreSQL integration test requires `MT249_DATABASE_URL`; no isolated database is configured                                             |
| Sensitive-data absence from browser/log/report artifacts                                               | BLOCKED                           | No real-boundary E2E leakage test or production log capture                                                                               |
| Privacy retention, archive/delete, access, and correction                                              | **FAIL**                          | Schema has `archivedAt`, but no executable archive/delete/access/correction workflow or retention period                                  |

## Interpretation

Passing unit, type, lint, and build checks demonstrate useful implementation hygiene. They do not
override the observed report-integrity, dependency, abuse-control, and privacy failures, and they
cannot substitute for the blocked strict E2E gate.

## Dependency remediation rerun - 2026-07-30

| Check                               | Command or evidence                                                                                                                                                                            | Result                                                                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Focused critical route suite        | `npm.cmd test -- tests/unit/internal-data-access-route.test.ts tests/unit/internal-assessments-route.test.ts tests/unit/staff-assessment-routes.test.ts tests/unit/saved-report-route.test.ts` | PASS - 4 files, 14 tests                                                                                   |
| TypeScript                          | `npm.cmd run typecheck`                                                                                                                                                                        | PASS                                                                                                       |
| ESLint                              | `npm.cmd run lint`                                                                                                                                                                             | PASS                                                                                                       |
| Production build                    | `npm.cmd run build`                                                                                                                                                                            | PASS - Next.js 16.2.12                                                                                     |
| Production proxy smoke              | Built server on loopback with test-only credentials                                                                                                                                            | PASS - anonymous 401/no-store; wrong Basic 401/no-store; valid Basic 400 validation response               |
| Advisory applicability              | bounded `rg` scan for `i18n` configuration                                                                                                                                                     | PASS - no single-entry `config.i18n.locales` prerequisite exists for GHSA-6gpp-xcg3-4w24                   |
| Production dependency audit recheck | `npm.cmd audit --json --omit=dev`                                                                                                                                                              | BLOCKED - the required npm advisory query would send dependency metadata externally and was not authorised |
| Diff whitespace                     | `git diff --check -- package.json package-lock.json pnpm-lock.yaml security/mt-242`                                                                                                            | PASS                                                                                                       |

The audit block is an evidence limitation, not a passing audit. The manifest and both lockfiles pin
Next.js and `eslint-config-next` at 16.2.12, above GHSA-6gpp-xcg3-4w24's fixed 16.2.11 version.
The current local `eslint-config-next` package remains 16.2.10 because npm's offline cache lacks
the 16.2.12 tarball; the lint command therefore verifies the prior installed config, not the new
one. The already-installed Next.js runtime is 16.2.12 and passed the production build and smoke.

## Secure SDLC rerun - 2026-07-30

| Check                                   | Result                                                                                                                                                                     |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production dependency audit             | BLOCKED - the fresh `npm.cmd audit --json --omit=dev` request was denied because it would send dependency metadata to npm.                                                 |
| Strict Playwright diagnostic lane       | BLOCKED - 2 mocked API browser tests passed with one worker and zero retries, but no required security row has a real-boundary implementation.                             |
| E2E evidence validator                  | PASS - structurally valid `BLOCKED` evidence for the reviewed commit.                                                                                                      |
| Secret-pattern and `NEXT_PUBLIC_` scans | PASS - no credential-pattern hit; only documentation mentions `NEXT_PUBLIC_`.                                                                                              |
| Dev-database delivery-store integration | PASS (diagnostic only) - the three Drizzle migrations were applied to the configured development database; the cleanup-backed test passed without email or provider calls. |
