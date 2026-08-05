# Security tests - public-lead-capture

| Check | Result | Evidence |
| --- | --- | --- |
| Form/API Other-detail contract | PASS | Focused form, persisted-contract, and route tests cover payload and required explanation. |
| Server-derived checked address | PASS at unit boundary | `buildServerAssessmentSubmission` derives address from verified signed snapshot. |
| Snapshot integrity/expiry | PASS at unit boundary | HMAC verification and 15-minute expiry in `assessment-snapshot.ts`. |
| SQL injection | PASS by code review | Drizzle query builder and tagged SQL; no concatenated SQL sink found in the assessment repository. |
| Secret/client exposure scan | PASS in bounded source scan | No `NEXT_PUBLIC_` runtime secret use found; `.env.example` contains blank values only. |
| Public access model | FAIL | `src/proxy.ts` applies shared Basic access to every non-loopback route, including the public discovery journey. |
| Staff object authorisation | FAIL for public release | Development-only shared boundary has no individual user or per-record policy. |
| Rate limiting / abuse controls | FAIL | No selected limiter, quota, queue, CAPTCHA, or origin/CSRF policy protects public assessment creation. |
| Privacy notice and lifecycle | FAIL | Consent text does not yet disclose processors/retention/rights; no archive/delete/access/correction path. |
| Strict isolated E2E | BLOCKED | Matrix has no executable real-boundary tests or isolated fixture infrastructure. |
| Dependency audit | BLOCKED | A fresh remote `npm audit` would require separate network authorisation. |

## Local validation

- `npx.cmd vitest run --configLoader runner` on the five lead-capture suites: PASS, 24 tests.
- `npm.cmd run typecheck`: PASS.
- `npm.cmd run lint`: PASS.
- `npm.cmd run build`: PASS.
- The full suite was not used as a security-pass substitute; a PDF runtime test is environment-blocked when Chromium is unavailable.
