# Security sign-off - customer-address

- Stack: node (source: `.secure-sdlc/stack.json`, marker: `package.json`)
- Mode: new
- Date: 2026-07-27
- Reviewed-commit: `655695e2dce98dba634830bd6087d20740708fa3`
- Verdict: **BLOCKED**

## Checklist

| Check | Result | Evidence |
|---|---|---|
| Security requirements | PASS | `security-requirements.md` |
| Data classification | PASS | `data-classification.md` |
| Threat model | PASS | `threat-model.md` |
| Architecture / authorization boundary | PASS pending implementation | `security-report.md`, SEC-001; existing login remains required |
| Input and output validation | PASS pending candidate review | Internal route bounds, safe errors, and response cap covered by unit tests |
| Rate limiting / abuse controls | N/A for authenticated POC | Anonymous access and distributed rate limiting are explicitly deferred |
| Authentication and authorization | PASS pending candidate review | Existing login boundary and unauthenticated route denial covered |
| Secrets and sensitive data | BLOCKED | Public artifact leakage tests absent |
| Strict E2E coverage matrix | BLOCKED | `e2e-matrix.md` |
| Strict E2E execution and validator | BLOCKED | `e2e-results.md`, `e2e-results.json` |
| OWASP Top 10:2021 | BLOCKED | High findings remain open |
| OWASP ASVS 4.0 L2 | BLOCKED | V4/V11/V13 evidence absent |
| NZ Privacy Act 2020 | BLOCKED | IPP5/IPP12 and operational handling unproven |

The remaining blockers are implementation and strict E2E evidence. Anonymous access and distributed rate limiting remain outside this POC sign-off.
