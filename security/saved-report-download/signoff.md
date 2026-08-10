# Security sign-off - saved-report-download

- Stack: node (source: `.secure-sdlc/stack.json`, `marker:package.json`)
- Mode: retrofit
- Date: 2026-08-10
- Reviewed-commit: `ea35f9c306fb2bef11ef4011c9883f3bdc51be0d`
- Candidate state: uncommitted working tree
- Target environment: local/test only; production was not used
- Verdict: **FAIL**

## Checklist

| Check                                        | Result                                           | Evidence                                                           |
| -------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------ |
| Security requirements                        | PASS as inventory                                | `security-requirements.md`                                         |
| Data classification                          | PASS as inventory                                | `data-classification.md`                                           |
| Threat model                                 | PASS as inventory                                | `threat-model.md`                                                  |
| Architecture and object authorization        | PASS at code/unit boundary; E2E BLOCKED          | `security-report.md`, SEC-SRD-010                                  |
| Input validation and output encoding         | FAIL                                             | SEC-SRD-006 and SEC-SRD-009                                        |
| Database access and delivery integrity       | PASS at code/unit boundary; E2E BLOCKED          | Drizzle predicates/claims; strict concurrency fixture absent       |
| Rate limiting and abuse controls             | FAIL                                             | SEC-SRD-004 and SEC-SRD-005                                        |
| Logging and auditability                     | BLOCKED                                          | Safe event design exists; runtime/alert evidence absent            |
| Secrets and sensitive data                   | PASS in bounded repository scan; runtime BLOCKED | `.gitignore`, environment-name-only scan, no production inspection |
| Dependency audit                             | FAIL                                             | SEC-SRD-001: 3 high, 1 moderate production advisories              |
| Strict E2E matrix                            | PASS as inventory                                | `e2e-matrix.md`                                                    |
| Strict E2E execution                         | BLOCKED                                          | `e2e-results.md`: 0/12 required rows                               |
| E2E evidence validation                      | BLOCKED verdict, structurally valid              | `e2e-results.json`; non-zero is required until PASS                |
| OWASP Top 10:2021                            | FAIL                                             | `security-report.md`                                               |
| OWASP ASVS 4.0 Level 2                       | FAIL                                             | `security-report.md`                                               |
| NZ Privacy Act 2020 code-verifiable controls | FAIL/BLOCKED                                     | SEC-SRD-002/003/011 and external IPP3A/IPP12 determinations        |
| Immutable reviewed candidate                 | BLOCKED                                          | Production/test code differs from current HEAD                     |

## Release blockers

1. SEC-SRD-001 through SEC-SRD-005 remain High.
2. SEC-SRD-006 and SEC-SRD-009 are reproduced validation failures.
3. SEC-SRD-010 leaves the strict E2E gate at 0/12 required rows.
4. SEC-SRD-011 leaves current IPP3A applicability/notice evidence unresolved.
5. The reviewed implementation is not represented by an immutable Git commit.

No merge, commit, push, deployment, provider enablement, production configuration, database mutation or external-delivery approval is granted.
