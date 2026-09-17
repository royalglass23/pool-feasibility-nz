# Testing and clean-gate guide

This guide defines the repository's test lanes and the evidence each one can
provide. Run release gates from a clean checkout of the exact candidate commit.
A local working-tree pass is useful development evidence, but it is not a
commit-bound release sign-off.

## Fast development checks

Use these while changing code:

```powershell
npm run typecheck
npm run lint
npm run format:check
npm test
```

Vitest owns unit, component, and integration coverage. A skipped test is
acceptable only when it is predefined and its environment requirement is
understood; do not count an unexpected skip as coverage.

## Browser lanes

The browser suites are intentionally separate because their server environments
are different.

### General product journeys

```powershell
npm run test:e2e
```

This runs the ordinary Property Check, analytics, report, map, and Staff Admin
journeys on port 3000. It excludes contact/partnership delivery and the dedicated
input-security suite. The configuration uses one Chromium worker and zero
retries so failures cannot be hidden by reruns.

### Contact and partnership journeys

```powershell
npm run test:e2e:contact
```

This starts a fresh server on port 3012 with synthetic contact delivery, blank
provider/database credentials, and local test rate limiting. It must not reuse a
normal development server because an unset delivery mode could send real email.

### Public-input safety

Run the database-disabled attack suite first:

```powershell
npx playwright test --config playwright.input-security.config.ts --grep-invert "dev report persists" --retries=0 --workers=1
```

It builds an isolated application copy, uses local Resend and Upstash fixtures,
and exercises injection-shaped text, HTML, control characters, malformed and
oversized requests, calm error responses, response leakage, and protected-route
boundaries.

The single persistence journey is optional and mutating. Run it only after
confirming that `DATABASE_URL_DEV` names an approved development database that
is distinct from every configured production target:

```powershell
$env:INPUT_SECURITY_DATABASE = "dev"
npx playwright test --config playwright.input-security.config.ts --grep "dev report persists" --retries=0 --workers=1
Remove-Item Env:INPUT_SECURITY_DATABASE
```

The host fails closed when the development URL is absent or matches a configured
production database. The test creates one synthetic idempotent assessment. It
does not clean that record automatically, because deletion requires separate
target authority.

Evidence is written under `tmp/input-security/`; when retained for an authorised
review, the local summary and verdict use `security/public-input-safety/`. Both
locations are ignored by repository policy. Do not treat local fixture results
as proof of deployed headers, TLS, secrets, managed rate limits, provider
delivery, or database bindings.

## Complete clean code gate

From a clean checkout of the selected commit, run in this order:

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

Then run the public-input safety lane above when public form, API, validation,
persistence, logging, or authentication boundaries are in scope.

Record the candidate commit, Node/npm versions, commands, pass/fail counts,
predefined skips, warnings, and generated evidence locations. Any unexpected
retry, flaky pass, test omission, dirty checkout, or target mismatch prevents a
clean PASS.

## What the code gate does not prove

The code gate does not prove that Vercel serves the reviewed revision or that
production database migrations, provider keys, sender identity, rate limiting,
retention, analytics consent, DNS, TLS, or rollback controls work on the target.
Complete those checks through [`deployment-runbook.md`](deployment-runbook.md)
and record the final decision in [`release-readiness.md`](release-readiness.md).
