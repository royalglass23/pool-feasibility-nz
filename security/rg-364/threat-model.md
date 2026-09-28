# Threat model — RG-364

## Trust boundaries

Anonymous browser input crosses public API validation into signed assessment state, then the development-database persistence boundary. Saved reports cross access-token and PDF/delivery boundaries. Staff views retain their existing authenticated boundary.

## Threats and controls

| Threat | Control and evidence |
|---|---|
| Stale or cross-audience state is saved | Placement identity, signed audience/site-answer snapshots, invalidation tests, homeowner/builder E2E |
| Duplicate save or delivery on retry | Idempotency-key behavior and saved-report reproduction tests |
| Tampered public fields or oversized/malformed input | Zod schemas, body limits, signed snapshots, 22-case input-security lane |
| Unauthorized report/staff access | Access-token verification and anonymous staff denial |
| Sensitive data leaks into analytics/evidence | Consent-gated analytics tests and synthetic local screenshots |
| UI focus or overlay prevents safe completion | Explicit stage focus, keyboard tests, analytics dismissal, mobile/200% evidence |
| Public status polling becomes abusive | Existing rate limits; persistence tests use direct authorized dev-DB observation rather than consuming public quota |

No new SSRF target, file upload, privileged action, or cross-tenant path is added.
