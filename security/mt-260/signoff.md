# Security sign-off - MT-260 traffic launch

- Stack: node (source: `.secure-sdlc/stack.json`, `marker:package.json`)
- Compliance profile: `nz-privacy`
- Mode: retrofit release gate
- Date: `2026-08-10T09:56:02.1548631+12:00`
- Reviewed-commit: `ebed3ef5f61db2bd5bb7a9450145f2d099446f92`
- Target environment: isolated non-production traffic-launch fixture (required but unavailable)
- Verdict: **FAIL**

## Checklist

| Check                                        | Result                   | Evidence                                                                                                  |
| -------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------- |
| Security requirements                        | PASS as inventory        | `security-requirements.md`                                                                                |
| Data classification / NZ Privacy scope       | PASS as inventory        | `data-classification.md`                                                                                  |
| Threat model                                 | PASS as inventory        | `threat-model.md`                                                                                         |
| Architecture and independent review          | FAIL                     | `code-review.md`; STD-001 and SPEC-005 open                                                               |
| Focused launch-control tests                 | PASS                     | 17 files / 65 tests in `security-tests.md`                                                                |
| Full unit/integration suite                  | FAIL                     | 357 passed, 7 failed, 2 skipped                                                                           |
| TypeScript                                   | PASS                     | `npm.cmd run typecheck`                                                                                   |
| Targeted launch-control lint                 | PASS                     | bounded `npx.cmd eslint` command                                                                          |
| Full repository lint                         | BLOCKED                  | no result after more than three minutes; terminated                                                       |
| Repository format check                      | FAIL (broad baseline)    | 67 files reported                                                                                         |
| Production build                             | PASS                     | Next.js 16.2.12 build completed                                                                           |
| Production dependency audit                  | BLOCKED                  | explicit npm-registry disclosure approval required                                                        |
| Strict E2E matrix                            | PASS as inventory        | `e2e-matrix.md`                                                                                           |
| Strict E2E execution                         | BLOCKED                  | `e2e-results.md`; 0/8 rows covered                                                                        |
| E2E evidence validation                      | BLOCKED, structure valid | Validator reported `verdict=BLOCKED` for exact HEAD and exited non-zero as required for non-PASS evidence |
| Authentication/session lifecycle             | BLOCKED for release      | focused tests pass; isolated account/browser/database missing                                             |
| Public distributed rate limits               | FAIL/BLOCKED             | primary routes pass locally; direct costly adapters open; real store missing                              |
| Delivery data boundary                       | BLOCKED for release      | focused allowlist passes; dedicated capture missing                                                       |
| Retention deletion                           | BLOCKED for release      | focused logic passes; disposable real records missing                                                     |
| Consent analytics                            | BLOCKED for release      | focused/browser-component logic passes; production-build network capture missing                          |
| OWASP Top 10:2021                            | FAIL                     | `security-report.md`                                                                                      |
| OWASP ASVS 4.0 L2                            | FAIL                     | `security-report.md`                                                                                      |
| NZ Privacy Act 2020 code-verifiable controls | FAIL/BLOCKED             | `security-report.md`                                                                                      |
| Candidate privacy/release scope              | FAIL                     | committed logs, residential report assets, prototypes, and unrelated research require review              |

## Blocking findings

1. No isolated MT-260 fixtures or executable strict Playwright lane.
2. Full suite has seven failures and two environment-skipped database integration tests.
3. Direct anonymous provider/PDF work is not covered by the documented shared limiter.
4. The committed candidate includes unrelated and privacy-sensitive release artifacts requiring explicit review/removal authority.
5. Current dependency audit, full lint, final deployment headers/TLS/origin, and real runtime privacy evidence are unavailable.

No deployment, production migration, production retention/deletion, customer-data use, external delivery, managed-store mutation, commit, push, or Linear closeout is authorised or represented by this sign-off.
