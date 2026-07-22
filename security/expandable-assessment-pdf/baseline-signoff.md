# Historical baseline security sign-off - expandable-assessment-pdf

> Historical evidence only. This FAIL verdict applies to commit `e47f4e6` before remediation and is not a verdict on the current candidate.

- Stack: node (source: `marker:package.json`)
- Mode: retrofit
- Date: 2026-07-22
- Reviewed-commit: `e47f4e6fd28a6ca4249f5d1a189c32ba6ad06933`
- Verdict: **FAIL**

## Checklist

| Check                                    | Result                         | Evidence                                                                                        |
| ---------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------- |
| Business/security requirements           | PASS                           | [security-requirements.md](security-requirements.md)                                            |
| Data classification and NZ privacy scope | PASS                           | [data-classification.md](data-classification.md)                                                |
| Threat model                             | PASS                           | [threat-model.md](threat-model.md)                                                              |
| Architecture review                      | FAIL                           | F-02, F-04, F-05 in [baseline-security-report.md](baseline-security-report.md)                  |
| E2E coverage matrix                      | PASS                           | 12 required / 12 mapped in [e2e-matrix.md](e2e-matrix.md)                                       |
| Strict E2E execution                     | **FAIL**                       | 5 passed / 4 failed / 0 skipped / 0 flaky in [baseline-e2e-results.md](baseline-e2e-results.md) |
| E2E evidence validator                   | FAIL                           | Evidence schema/commit valid; validator exits non-zero because verdict is FAIL                  |
| Authentication and authorization         | PASS for local one-role POC    | Anonymous/wrong-credential production-boundary tests                                            |
| Input validation and output encoding     | **FAIL**                       | Fake PNG injection and unbounded nested content reached Chromium                                |
| Report/data integrity                    | **FAIL**                       | Caller-tampered facts produced a PDF                                                            |
| Renderer abuse/availability              | **FAIL**                       | Concurrent render requests both succeeded; no timeout/gate                                      |
| Evidence-use and attribution             | **FAIL**                       | Licence-limited evidence and unattributed canvas can enter PDF                                  |
| Error handling                           | PASS                           | Generic safe errors and correlation ID behavior passed                                          |
| Logging and monitoring                   | **FAIL**                       | No PDF security outcome/audit events                                                            |
| Secrets and sensitive data               | PASS/PARTIAL                   | No committed secret pattern; no-store/session-only; deployment transport not proved             |
| Dependency audit                         | PASS runtime / backlog tooling | 0 production vulnerabilities; 7 moderate development-tool findings                              |
| Database review                          | N/A                            | Feature performs no database operation and POC has no report datastore                          |
| Production build                         | PASS                           | `npm.cmd run build` at reviewed commit with evidence-only working-tree files                    |
| External/customer release                | **FAIL / NO-GO**               | Open High findings and unresolved source-reuse/attribution controls                             |

## Release decision

Do not promote, deploy, or represent the PDF as a security-reviewed external/customer report. The existing local/internal POC boundary may remain, but PDF generation is not ready for release until F-01 through F-05 are remediated, committed, and the strict zero-retry lane plus validator pass against the new commit.
