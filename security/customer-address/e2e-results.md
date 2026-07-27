# E2E results - customer-address

- Base commit: `655695e2dce98dba634830bd6087d20740708fa3`
- Candidate state: uncommitted working tree; this partial run is not merge evidence.
- Environment: isolated local Next.js dev server at `http://127.0.0.1:3000`, Chromium, one worker, mocked LINZ-backed application response.
- Commands: `npx.cmd playwright test tests/e2e/data-access-inspector.spec.ts -g "legal parcel" --workers=1 --retries=0`; `npx.cmd playwright test tests/e2e/data-access-inspector.spec.ts -g "unconfirmed parcel" --workers=1 --retries=0`.
- Required rows: 9 (one deferred POC rate-limit row is not required)
- Covered: 3
- Passed / failed / skipped / flaky: 3 / 0 / 0 / 0
- Verdict: **BLOCKED**

The three parcel-status journeys pass. The strict E2E gate remains blocked because the full authenticated address matrix, including login denial/success, malformed input, provider failure, keyboard flow, and artifact-leakage cases, is not yet covered. The evidence validator was not run because this partial lane cannot support PASS.
