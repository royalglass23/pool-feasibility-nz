# Data classification — complete constructability journey

| Data | Classification | At rest | In transit | Retention | Notes |
|---|---|---|---|---|---|
| Name, phone, email | Personal (PII) | `homeowner_assessments` | HTTPS public assessment submission and report delivery | Existing 12-month policy and deletion workflow | Not placed in URLs or test artifacts; E2E uses `.example.test` synthetic data |
| Property address and coordinates | Personal / confidential | `homeowner_assessments` JSON and columns | HTTPS public assessment submission | Same assessment retention | Precise location; not logged by RG-345 tests |
| Pool and route geometry, Site answers, depth | Confidential | Saved report JSONB and layout JSON | HTTPS public submission; authenticated staff response | Same assessment retention | Submission-time snapshot is reproduced; providers are not rerun in staff view |
| Provider availability and provenance | Internal | Saved constructability report | Public report and authenticated staff response | Same assessment retention | May be shown to the report recipient; absence never means no concern |
| Staff session token | Secret credential | Only a SHA-256 hash in `staff_sessions` | Secure same-site HTTP-only cookie in production | Eight-hour session; server-side invalidation | E2E token is ephemeral and its exact row is removed in `finally` |
| Assessment snapshot token | Secret integrity token | Browser memory during the journey; persisted evidence is decoded into report data | Same-origin public APIs | 15-minute token TTL | HMAC protected with a server-only secret |
| Provider/API/database credentials | Secret | Environment or deployment secret store | Server-side provider/database connections | Deployment-controlled | `.env` is untracked; RG-345 does not print or persist values |
| Playwright trace/report | Internal test evidence | Ignored local output | None by the test | Ephemeral | Trace retained only on failure; current strict run has no traces |

Data minimization: RG-345 collects no new runtime field. The staff E2E record uses synthetic data and deletes only the exact session, assessment, and test-created admin rows.
