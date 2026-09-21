# RG-345 security test evidence

| Case | Boundary | Result | Evidence |
|---|---|---|---|
| Anonymous staff force-browse | `/staff` and `/staff/<id>` | PASS | `staff-assessments.spec.ts`; redirect occurs before internal assessment request |
| Authenticated read-only staff detail | Staff page, session store, internal API, development DB | PASS | Synthetic session and assessment expose saved evidence with no form or mutation controls |
| Session cleanup | Development DB | PASS | Test deletes the exact session and only deletes the singleton admin when the test created it |
| Public invalid text and focus | Assessment form | PASS | Injection-shaped additional text is rejected, described accessibly, and focused |
| Signed depth and Site answers | Site-answer and assessment boundaries | PASS | 1.50 m and 1.70 m values plus exclusive answers survive submission and report reproduction |
| Mapped, user, and conflicting evidence | Public assessment handler and development DB | PASS | Each provenance shape is persisted and independently reloaded; conflicts remain `Needs checking` |
| Audience equivalence | Public assessment handler and development DB | PASS | Identical constructability inputs for homeowner and pool builder reproduce exactly equal saved snapshots |
| Adjusted route persistence | Site-answer handler, public assessment handler, and development DB | PASS | Keyboard/pointer-adjusted route and derived route facts survive save and reload |
| Conservative provider failure | Saved report | PASS | Provider error remains visible and overall constructability is `Not fully assessed` |
| Public delivery failure | Saved report | PASS | Report remains accessible and exposes no resend or public PDF controls |
| Dependency vulnerabilities | Production dependencies | PASS | `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities |
| Committed focused tests | Repository | PASS | No `test.only`, `describe.only`, or `test.fixme` found |
| Secret file tracking | Repository | PASS | `.env` is not tracked |

Supporting focused Vitest lane: 96 passed and 3 environment-gated integration tests skipped. Full Vitest lane after remediation: 835 passed and 4 expected environment-gated skips.
