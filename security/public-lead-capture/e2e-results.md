# E2E results - public-lead-capture

- Reviewed commit: `cc3f9204a772df716852576186c35079aabbed90`
- Candidate state: mixed uncommitted working tree
- Environment: blocked local diagnostic target at `http://127.0.0.1:3000`; no isolated database or delivery capture exists.
- Command attempted: `npx.cmd playwright test tests/e2e/homeowner-report.spec.ts tests/e2e/staff-assessments.spec.ts --workers=1 --retries=0`
- Verdict: **BLOCKED**

The command did not discover tests: Playwright's configured `webServer` could not start because an existing user-owned Next development server already owns this repository's build state on port 3020. It was not stopped or changed.

More importantly, both named specs mock internal APIs and cannot cover any required row. The strict lane has zero executable tests and lacks an isolated database, fake email/ServiceM8 capture, individual staff identities, safe log capture, and a production-build harness. No trace or HTML report was generated.

| Measure | Count |
| --- | ---: |
| Required matrix rows | 7 |
| Covered strict rows | 0 |
| Executed strict tests | 0 |
| Passed / failed / skipped / flaky | 0 / 0 / 0 / 0 |
