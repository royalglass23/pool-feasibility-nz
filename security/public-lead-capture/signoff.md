# Security sign-off - public-lead-capture

- Stack: node (source: `.secure-sdlc/stack.json`, `marker:package.json`)
- Mode: retrofit
- Date: 2026-08-04
- Reviewed-commit: `cc3f9204a772df716852576186c35079aabbed90`
- Candidate state: mixed uncommitted working tree
- Target environment: public Auckland discovery site; no production target was used.
- Verdict: **FAIL**

## Checklist

| Check | Result | Evidence |
| --- | --- | --- |
| Security requirements | PASS as inventory | `security-requirements.md` |
| Data classification | PASS as inventory | `data-classification.md` |
| Threat model | PASS as inventory | `threat-model.md` |
| Architecture / public access model | FAIL | SEC-PLC-001 in `security-report.md` |
| Input validation / integrity | PASS at unit/code boundary | `security-tests.md` |
| Database review | FAIL for release | Privacy lifecycle and access model gaps |
| Rate limiting / abuse controls | FAIL | SEC-PLC-002 |
| Logging / auditability | FAIL | SEC-PLC-005 |
| Secrets / client exposure scan | PASS in bounded scan | `security-tests.md` |
| Dependency audit | BLOCKED | SEC-PLC-006 |
| Strict E2E coverage matrix | PASS as inventory | `e2e-matrix.md` |
| Strict E2E execution | BLOCKED | `e2e-results.md` |
| E2E evidence validation | BLOCKED verdict, structurally valid | `e2e-results.json` |
| OWASP Top 10:2021 | FAIL | `security-report.md` |
| OWASP ASVS 4.0 L2 | FAIL | `security-report.md` |
| NZ Privacy Act 2020 code-verifiable controls | FAIL | `security-report.md` |
| Immutable reviewed candidate | BLOCKED | Candidate implementation is uncommitted/mixed |

## Blocking findings

1. SEC-PLC-001: public journey is blocked by an unsuitable shared staff access boundary.
2. SEC-PLC-002: no abuse controls protect public costly operations.
3. SEC-PLC-003: personal-data notice and lifecycle controls are incomplete.
4. SEC-PLC-004: strict isolated E2E proof is absent.

No public deployment, customer-data migration, commit, push, or release approval is granted by this sign-off.
