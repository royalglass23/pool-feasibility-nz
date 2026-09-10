# Release readiness and evidence map

This page tells a reviewer what is currently known. It does not grant deployment,
database-migration, credential, external-email, or production-test authority.

## Current position

The `features` branch contains a deployment-shaped Auckland Property Check with
anonymous public routes, persisted assessments, emailed PDFs, Admin-only saved
records, shared rate limiting, retention, consent-gated analytics, and public
contact/partnership forms.

The old July 2026 decision that described an internal, no-database,
session-scoped POC is superseded as a product description. Its test results
remain historical evidence only.

There is no single release-evidence pack bound to the current `HEAD`:

- dependency remediation is **PASS** for commit `5e34e16`;
- the report-input remediation was independently reviewed as ready to commit,
  and its production-like browser lane passed, but its formal sign-off predates
  the dependency fix; and
- later public form-feedback changes landed after the dependency evidence.

Therefore, treat the present repository as **not yet covered by one complete
current release sign-off**. Re-run the required gates against the exact commit
selected for promotion and verify the target environment separately.

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

Use the dedicated security configurations/evidence validators for the feature
being released. A passing focused test is evidence for that slice, not a waiver
for a failed or missing full gate.

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

| Area                           | Evidence                                                                                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Current dependency remediation | [`../security/dependency-remediation/signoff.md`](../security/dependency-remediation/signoff.md)                                         |
| Public input validation        | [`../security/report-input-validation/signoff.md`](../security/report-input-validation/signoff.md)                                       |
| Input-remediation review       | [`../security/report-input-validation/review/remediation-results.md`](../security/report-input-validation/review/remediation-results.md) |
| Public lead-capture history    | [`../security/public-lead-capture/signoff.md`](../security/public-lead-capture/signoff.md)                                               |
| Report-delivery history        | [`../security/production-report-delivery/signoff.md`](../security/production-report-delivery/signoff.md)                                 |
| Traffic-launch history         | [`../security/mt-260/signoff.md`](../security/mt-260/signoff.md)                                                                         |

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
