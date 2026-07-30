# Security sign-off - MT-242

- Stack: node (source: `.secure-sdlc/stack.json`, `marker:package.json`)
- Mode: retrofit
- Date: 2026-07-30
- Reviewed-commit: `8783a6b4d0cfdc0beb53d63edf05b9fb7e49e70a`
- Candidate state: mixed uncommitted working tree
- Target environment: isolated local development only
- Verdict: **FAIL**

## Checklist

| Check                                        | Result                      | Evidence                                                                               |
| -------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------- |
| Security requirements                        | PASS                        | `security-requirements.md`                                                             |
| Data classification and NZ Privacy scope     | PASS as inventory           | `data-classification.md`                                                               |
| Threat model                                 | PASS                        | `threat-model.md`                                                                      |
| Architecture and report integrity            | FAIL                        | SEC-242-001 in `security-report.md`                                                    |
| E2E coverage matrix                          | PASS as inventory           | `e2e-matrix.md`                                                                        |
| Strict E2E execution                         | BLOCKED                     | `e2e-results.md`, 2 diagnostic tests passed but 0/14 required security rows            |
| E2E evidence validator                       | PASS (structural validity)  | Validator accepts current `BLOCKED` evidence; zero executed required rows still block  |
| Authentication and authorization             | FAIL                        | Proxy smoke passes after SEC-242-002 remediation; real object-level E2E remains absent |
| Input validation and output encoding         | FAIL overall                | Strong bounds/encoding, but semantic fact forgery remains                              |
| Database security                            | FAIL overall                | Parameterized/constraint controls pass; retention and client-authoritative facts fail  |
| Rate limiting and abuse controls             | FAIL                        | SEC-242-003                                                                            |
| Logging and auditing                         | FAIL                        | SEC-242-006                                                                            |
| Secrets and client exposure                  | PASS within repository scan | `security-tests.md`                                                                    |
| Dependency audit                             | BLOCKED                     | Next.js 16.2.12 candidate is above affected range; fresh remote audit not authorised   |
| OWASP Top 10:2021                            | FAIL                        | `security-report.md`                                                                   |
| OWASP ASVS 4.0 L2                            | FAIL                        | `security-report.md`                                                                   |
| NZ Privacy Act 2020 code-verifiable controls | FAIL/BLOCKED                | SEC-242-004                                                                            |
| Focused tests/typecheck/lint/build           | PASS                        | `security-tests.md`                                                                    |
| Repository formatter                         | FAIL                        | 34 files reported                                                                      |
| Immutable reviewed candidate                 | BLOCKED                     | Feature implementation is uncommitted and mixed                                        |

## Blocking findings

1. SEC-242-001 - client-authored facts can forge a saved/emailed report.
2. SEC-242-003 - costly assessment/provider/PDF/email work lacks abuse controls.
3. SEC-242-004 - personal-data notice, retention, rights, and processor safeguards are incomplete.
4. SEC-242-005 - strict E2E and immutable candidate evidence are unavailable.

SEC-242-002 is remediated in the local candidate by the Next.js 16.2.12 upgrade. Its fresh
production-audit confirmation, including the historical transitive `sharp` result, remains blocked
pending approval to send dependency metadata to npm; this does not change the overall FAIL verdict.

No production/customer use, merge, deployment, migration, commit, push, or Linear closeout is
authorized by this sign-off.
