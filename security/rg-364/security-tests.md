# Security tests — RG-364

## Executed

- Input-security Playwright suite in database-disabled mode: 21 applicable cases passed; the dev-only persistence case was intentionally unavailable.
- Input-security Playwright suite with guarded `INPUT_SECURITY_DATABASE=dev`: the dev persistence case and 20 other applicable cases passed; the mutually exclusive database-unavailable assertion returned 201 as expected for this mode.
- Production dependency audit: `npm audit --omit=dev --audit-level=high` reported 0 vulnerabilities.
- Working-tree full application Playwright: 22/22 passed, zero retries.
- Exact-commit full application Playwright: 21/22 passed, zero retries; the only failure is the unrelated stale staff fixture name documented in `e2e-results.md`.
- Full Vitest: 132 files passed, 947 tests passed, 3 files/4 tests skipped by environment gates.
- TypeScript and ESLint: pass; ESLint reports three pre-existing warnings and no errors.
- Production Next.js build: pass.

## Interpretation

The two input-security modes are intentionally mutually exclusive. Taken together, every case has a passing execution in its required environment. No production database, credential, email delivery, migration, or deployment was used.
