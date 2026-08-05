# Security requirements - public-lead-capture

- Mode: retrofit
- Reviewed commit: `cc3f9204a772df716852576186c35079aabbed90`
- Candidate state: uncommitted, mixed working tree
- Target: an Auckland-first public discovery site; no deployment is authorised.

| ID | Testable requirement |
| --- | --- |
| SR-PLC-01 | An anonymous visitor can use the public Property Check and submit a report request without staff credentials, while staff-only records remain inaccessible. |
| SR-PLC-02 | The server accepts only bounded contact context, a signed short-lived property snapshot, and a user-controlled pool layout; the checked address remains server-sourced. |
| SR-PLC-03 | A visitor selecting `Other` for role or timing must supply a bounded explanation; malformed, oversized, replayed, or forged submissions do not create a record or delivery. |
| SR-PLC-04 | Exact address, name, phone, email, report, map, and project context are treated as personal data: absent from URLs, browser storage, logs, public analytics, and unauthorised responses. |
| SR-PLC-05 | Processing is clearly disclosed before submission, including delivery processors, retention, access/correction/deletion route, and no-marketing distinction. |
| SR-PLC-06 | Expensive property, report, PDF, database, and delivery work has observable anti-automation controls appropriate to the public audience. |
| SR-PLC-07 | Staff record and PDF reads require production-grade individual authentication and per-record authorisation; direct routes cannot disclose another visitor's record. |

## Actors and non-goals

- Untrusted anonymous visitor: may start a property check and request their own preliminary report.
- Royal Glass staff: may later review leads, but a shared development credential is not an acceptable public identity model.
- External processors: LINZ/Auckland GIS, Neon, Resend, and ServiceM8 only receive the minimum data their boundary requires.
- Non-goals: builder matching, marketing automation, retargeting, public price quoting, consent/engineering advice, and production rollout.
