# MT-242 dependency remediation review ledger

- Review target: uncommitted dependency candidate in `package.json`, `package-lock.json`, and
  `pnpm-lock.yaml`; the repository contains unrelated user-owned mixed work that was excluded.
- Initial review date: 2026-07-30
- Validation evidence: focused route tests (14/14), typecheck, lint, production build on Next.js
  16.2.12, and loopback production proxy smoke all pass. A fresh npm production audit is blocked
  because its advisory query would send dependency metadata externally.

| ID            | Axis      | Finding                                                                                                           | Status  | Verification / required next action                                                                                                                                                                                                                                                                                                       |
| ------------- | --------- | ----------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| STD-MT242-001 | Standards | npm lockfile regeneration added unrelated Tailwind Oxide bundled metadata.                                        | fixed   | Removed the six unrelated records; scoped lockfile diff is now only the Next.js/eslint-config-next version resolution, `git diff --check` passes, and `package-lock.json` parses as JSON.                                                                                                                                                 |
| SPEC-001      | Spec      | P0 requires confirmation that the historical transitive `sharp` advisory is removed via a fresh production audit. | blocked | Run `npm.cmd audit --json --omit=dev` only after approval to send dependency metadata to npm; do not infer an audit result from the lockfile.                                                                                                                                                                                             |
| SPEC-002      | Spec      | P0 calls for proxy-bypass regression coverage.                                                                    | invalid | GHSA-6gpp-xcg3-4w24 applies only to App Router applications built with Turbopack and a single `config.i18n.locales` entry. A repository scan found no `i18n` configuration, so there is no applicable exploit shape to execute. The candidate is also on fixed Next.js 16.2.12 and the normal production proxy boundary was smoke-tested. |

The blocked audit is retained as a release-evidence gap. This ledger does not change the overall
MT-242 security sign-off, which remains **FAIL** for the unresolved report-integrity, abuse,
privacy, and strict-E2E blockers.
