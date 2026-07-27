# Security report - customer-address

- Mode: new
- Reviewed commit: `655695e2dce98dba634830bd6087d20740708fa3`
- Stack: Node/Next.js; Playwright available; NZ Privacy Act 2020 profile declared.
- Scope: authenticated LINZ-backed address autocomplete and legal-parcel status, while preserving staff-only internal assessment routes.

## Findings

### SEC-001 - Authentication boundary must remain intact

- Severity: High
- Evidence: `src/app/api/internal/address-suggestions/route.ts` is protected by `authorizeInternalRequest`; `docs/release-readiness.md` says external/customer release is NO-GO.
- Risk: Removing the internal authorization would expose staff functionality and provider traffic. The POC does not require anonymous access or distributed rate limiting.
- Required action: keep the existing login boundary and test denied/valid login paths.
- Release impact: implementation requirement, not a rate-limit blocker for this POC.

### SEC-002 - Strict E2E evidence incomplete

- Severity: High
- Evidence: three authenticated parcel-status journeys now pass, but `e2e-matrix.md` has 9 required rows and only three are covered.
- Risk: authorization, abuse control, browser leakage, and customer-visible fail-closed behavior are unproven.
- Required action: add the remaining authenticated login, input/error, accessibility, and leakage journeys; validate evidence against the exact commit.
- Release impact: blocker.

### SEC-003 - Address data is personal information risk

- Severity: Medium
- Evidence: address and LINZ identifiers are sent through the proposed customer flow; no persistence is intended.
- Risk: raw addresses could leak through URLs, logs, traces, or provider telemetry; NZ Privacy Act IPP5/IPP8/IPP9/IPP12 controls are not yet evidenced.
- Required action: minimise fields, redact logs, document processor/region handling, and add artifact leakage tests.
- Release impact: blocker if IPP5 or IPP12 fails; currently blocked pending design evidence.

## Standards checked

- OWASP Top 10:2021
- OWASP ASVS 4.0 Level 2 condensed review
- Node stack checklist
- NZ Privacy Act 2020 code-verifiable controls
- API security, E2E, and penetration-test checklists

## Positive existing controls

- Internal authorization with loopback-development exception and constant-time credential comparison.
- LINZ gateway response size, query bounds, provider host allow-list, timeout, and safe error patterns.
- Correlation IDs and no raw provider response contract in existing routes.

These controls authorize the authenticated POC boundary. They do not authorize anonymous customer exposure; rate limiting remains deferred until that boundary changes.
