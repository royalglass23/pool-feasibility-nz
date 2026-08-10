# E2E results - saved report download and delivery

- Reviewed commit: `ea35f9c306fb2bef11ef4011c9883f3bdc51be0d`
- Candidate: uncommitted working tree; not an immutable reviewed commit
- Environment: local Next.js development server at `http://127.0.0.1:3000`
- Command: `npx.cmd playwright test tests/e2e/homeowner-report.spec.ts --project=chromium --workers=1 --retries=0`
- Diagnostic result: 1 passed, 0 failed, 0 skipped, 0 flaky, zero retries
- Strict matrix: 0 of 12 required rows covered
- Verdict: **BLOCKED**

The passing journey verifies report-page status rendering, button alignment and a browser download against route-fulfilled responses. It stubs assessment creation, delivery and PDF bytes, runs against `next dev`, has no disposable database or managed limiter, and does not exercise token verification, persistence, real PDF rendering, durable delivery or provider capture.

Strict execution requires an isolated non-production production build, unique seeded records, real application routes and database, a managed-store-compatible limiter, real renderer, controlled homeowner delivery capture, ServiceM8-disabled fixture, log capture and teardown. The required test file does not exist.

The machine-readable evidence is structurally valid for a `BLOCKED` verdict. Its validator intentionally exits non-zero because only `PASS` evidence can clear the E2E gate.
