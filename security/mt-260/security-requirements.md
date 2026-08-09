# Security requirements - MT-260 traffic launch

- Mode: retrofit release gate
- Ticket: Linear `MT-260`, parent `MT-238`
- Reviewed commit: `ebed3ef5f61db2bd5bb7a9450145f2d099446f92`
- Target: isolated, non-production, production-build Auckland traffic-launch fixture
- Review time: `2026-08-10T09:56:02.1548631+12:00`

| ID          | Testable requirement                                                                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SR-MT260-01 | A clean anonymous browser can complete address search, Property Check, and report request without an Admin credential.                                                         |
| SR-MT260-02 | Every Staff Workspace page, list/detail API, and saved-report boundary denies an unauthenticated caller or redirects to sign-in without leaking a record identifier.           |
| SR-MT260-03 | One disposable Admin fixture proves sign-in, non-enumerating failure, five-failure lockout for 15 minutes, server-side sign-out invalidation, and eight-hour expiry.           |
| SR-MT260-04 | A real isolated Upstash-compatible store enforces 10 Property Checks per 30 minutes and 3 report requests per hour with zero test retries.                                     |
| SR-MT260-05 | A dedicated capture boundary proves the homeowner receives the PDF while ServiceM8 receives only reference, contact details, checked address, visitor type, and timing.        |
| SR-MT260-06 | Retention deletes only dedicated disposable report-request records at 12 months, safely skips active deliveries, records no deleted PII, and is idempotent.                    |
| SR-MT260-07 | GA4 remains absent before consent and receives only allowlisted anonymous funnel fields after consent.                                                                         |
| SR-MT260-08 | The strict lane uses an isolated database, dedicated delivery fixtures, a non-production distributed store, one worker, zero retries, and no production/customer side effects. |
| SR-MT260-09 | Evidence records the reviewed commit, environment fingerprint, fixture version, command, timestamp, counts, artifacts, failures, and an honest PASS, FAIL, or BLOCKED verdict. |

## Actors and exclusions

- Untrusted anonymous visitor: can use only the public journey.
- Staff Admin: the single individually provisioned launch account; no public registration or shared Basic credential.
- Fixture operator: may create and delete only dedicated MT-260 records and identities in the named isolated target.
- Processors: Neon, Resend, ServiceM8 forwarding, and Upstash receive only data required by their documented boundaries.
- Excluded: production traffic, real customer data, production retention deletion, production delivery, deployment, migration, Search Console activation, and release approval by inference.
