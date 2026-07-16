# 08 — Harden and prove the Auckland POC

## Parent

`famiglia/geomap-intial/contract.md`

## What to build

Close the POC with security, performance, accessibility, observability, retention, deployment/rollback, documentation, and the complete fixture-backed acceptance journey while performing a separate manual live validation of the proof property.

## Acceptance criteria

- [ ] Rate limiting, idempotency, provider allow-listing, timeout/retry/concurrency, response/geometry limits, and safe logging have abuse tests.
- [ ] Licence-aware caching, retention/deletion, credential rotation, migration, rollback, and provider-disable runbooks exist.
- [ ] Logs/metrics explain address/parcel decisions, provider latency/availability, candidate analysis, score/confidence/flags, and PDF generation without leaking secrets or unnecessary address data.
- [ ] Explicit performance budgets are measured for analysis, provider fan-out, map interactivity, and PDF generation.
- [ ] Keyboard/screen-reader semantics, contrast, focus, responsive layouts, and automated accessibility checks pass.
- [ ] Playwright fixture journey covers the full test-address request, progress, resolved address, score/result/confidence, real-map fixture contract/attribution, risks/actions, and PDF.
- [ ] Manual live validation confirms official data behavior for 42A without placing live calls in CI.
- [ ] All required documentation is current; unavailable datasets and product limitations are prominent.
- [ ] Security, architecture/spec review, full validation gate, and release-readiness verdict are green before any launch.

## Blocked by

Job 07.
