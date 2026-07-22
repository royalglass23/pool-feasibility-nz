# Pre-commit strict E2E diagnostic - expandable-assessment-pdf

- Evidence status: pre-commit diagnostic; not formal committed-revision sign-off
- Base commit: `e47f4e6fd28a6ca4249f5d1a189c32ba6ad06933`
- Candidate: current uncommitted working tree
- Environment: actual local Next.js production build and proxy on `http://127.0.0.1:3100`
- Server command: `npm.cmd run start -- -p 3100`
- Test command: `npx.cmd playwright test --config security/expandable-assessment-pdf/playwright.security.config.ts`
- Project/workers/retries: Chromium / 1 / 0
- Controlled fixture: `normalized-data-access-v1`; no live providers or database
- Result: **9 passed, 0 failed, 0 skipped, 0 flaky**
- Diagnostic verdict: **PASS**

## Covered production-boundary behavior

Authentication denial, three-page PDF generation and headers, raw-body limits,
strict PNG validation, signed-snapshot integrity, nested-content rejection,
HTML escaping, safe validation errors and correlation IDs, and bounded concurrent
Chromium rendering all passed through the built Next.js server and proxy.

Formal Secure SDLC evidence and sign-off must be regenerated against the eventual
committed revision. This diagnostic does not authorize commit, deployment, or
external/customer release.
