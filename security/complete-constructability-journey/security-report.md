# Security report — complete constructability journey

## Scope and result

RG-345 is a retrofit release-evidence ticket. It adds no runtime endpoint, permission, schema, or collected field. It strengthens public and authenticated browser evidence and isolates browser execution from another local product and from the production database.

The application and test checks are green. The formal verdict is **PASS** after the zero-retry strict E2E lane was rerun and validated against immutable commit `32491d48c4808325745b9465e879e4b41d9e7c6a`.

## Evidence

- Strict E2E: 21 passed, 0 failed, 0 skipped, 0 flaky with zero retries. Public save/reload, adjusted-route persistence, mapped/user/conflict provenance, audience equivalence, and authenticated staff access all use production handlers against the development database. See [e2e-results.md](./e2e-results.md).
- Full Vitest: 835 passed, 4 expected environment-gated skips.
- Focused security/constructability Vitest: 96 passed, 3 environment-gated integration skips.
- TypeScript, ESLint, Prettier, and diff whitespace checks: passed for the final candidate.
- Production build: passed.
- Production dependency audit: 0 vulnerabilities.

## OWASP Top 10:2021

| Category | Result | Evidence |
|---|---|---|
| A01 Broken Access Control | PASS | Staff page and API session checks; anonymous and authenticated browser coverage |
| A02 Cryptographic Failures | PASS in code scope | HMAC snapshots and hashed staff tokens; TLS/at-rest controls remain deployment/provider responsibilities |
| A03 Injection | PASS | Positive schemas, safe rendering, Drizzle query builder, input-security tests |
| A04 Insecure Design | PASS | Requirements, data inventory, threat model, and conservative provider-failure semantics |
| A05 Security Misconfiguration | PASS for ticket | Dedicated test port and explicit development DB; no debug route added |
| A06 Vulnerable Components | PASS | Production dependency audit reports 0 vulnerabilities |
| A07 Authentication Failures | PASS | Server-side expiring sessions, secure cookie settings, lockout coverage, anonymous denial |
| A08 Software/Data Integrity | PASS | Signed assessment snapshots and saved snapshot reproduction |
| A09 Logging/Monitoring | PASS for ticket | Existing structured security outcomes avoid contact/property values; RG-345 adds no sensitive logging |
| A10 SSRF | N/A | No new user-controlled server fetch target |

## OWASP ASVS 4.0 Level 2 subset

V1, V3, V4, V5, V7, V8, V11, V13, and V14 pass for this bounded ticket. V2 relies on the existing password and lockout implementation; RG-345 does not change it. V6 and V9 depend partly on database/deployment controls and are not newly asserted by local HTTP tests. V10 passes through a clean production dependency audit. V12 is not applicable because no file upload or new resource-serving path is added.

## API, database, logging, and secrets review

- Public report submission remains schema validated and snapshot verified; staff list/detail APIs check the server-side session before data access.
- Drizzle query construction is parameterized. The staff E2E uses exact UUID and username predicates for cleanup.
- The product is single-admin/single-workspace in this release, so cross-tenant and wrong-role cases are not applicable; anonymous forced browsing remains required and passes.
- Personal data is persisted only through the existing assessment model and retention workflow. RG-345 test data is synthetic.
- `.env` is untracked and no secret values, cookies, traces, or screenshots are added to the candidate.

## Findings and release impact

| ID | Severity | Status | Evidence | Next action | Release impact |
|---|---|---|---|---|---|
| SEC-001 | Important | Resolved | Strict E2E reran 21/21 against commit `32491d48`; machine evidence records that immutable candidate | Commit the pending evidence-only files without changing code, tests, configuration, fixtures, environment, or matrix | None |

No open High or Critical security finding exists.
