# Gap report - public-lead-capture

| ID | Severity | Gap | Required remediation | Release impact |
| --- | --- | --- | --- | --- |
| SEC-PLC-001 | High | Public discovery is globally gated by shared Basic access. | Split public and staff boundaries; use individual staff auth and server-side record authorisation. | Blocks traffic launch. |
| SEC-PLC-002 | High | No public abuse controls protect expensive GIS/report/database/email work. | Add rate limit/quota, anti-automation, origin/CSRF policy, and bounded queue/observability. | Blocks public lead capture. |
| SEC-PLC-003 | High | Personal-data notice, retention, rights, and processor disclosure are incomplete. | Adopt reviewed privacy notice and implement retention/archive/delete/access/correction controls. | Blocks collecting public contact/property data. |
| SEC-PLC-004 | High | No strict real-boundary E2E evidence exists. | Create isolated DB + fake delivery capture, implement all seven matrix rows, run production build with zero retries, and validate evidence. | Blocks PASS/merge/release sign-off. |
| SEC-PLC-005 | Medium | Security/audit event coverage is incomplete. | Add privacy-safe events for denials, validation/abuse rejections, staff reads, creation, and delivery outcomes. | Blocks production operational readiness. |
| SEC-PLC-006 | Medium | Fresh production dependency audit is unavailable. | Authorise and run `npm audit --json --omit=dev`; triage results. | Blocks component assurance. |
