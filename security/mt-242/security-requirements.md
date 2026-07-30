# Security requirements - MT-242

- Feature: MT-242, nationwide fast homeowner pool feasibility workflow
- Mode: retrofit
- Target environment: isolated local development only
- Production/customer deployment: out of scope and not authorized
- Reviewed base commit: `8783a6b4d0cfdc0beb53d63edf05b9fb7e49e70a`
- Candidate state: mixed uncommitted working tree

## Actors and trust

| Actor                                                                       | Trust                   | Permitted capability                                                                                                                             |
| --------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Homeowner/browser                                                           | Untrusted               | Search an address, manipulate one exploratory layout, provide contact details and consent, submit one assessment, and view the resulting report. |
| Royal Glass staff                                                           | Privileged but fallible | Read active assessments and reports within the explicitly development-only staff boundary.                                                       |
| Application operator                                                        | Privileged              | Configure server-only credentials, database access, and the isolated test/development environment.                                               |
| LINZ, regional GIS providers, Neon, Resend, and ServiceM8 email destination | External boundary       | Receive only the bounded data needed for their documented purpose.                                                                               |
| Internet or local-network attacker                                          | Hostile                 | No permitted access to internal routes, records, credentials, or provider capacity.                                                              |

## Protected assets

- Homeowner identity and contact data.
- Precise residential address, coordinates, mapped boundary, aerial image, and proposed pool layout.
- Consent record, assessment status, warning state, recommendations, and report reference.
- Official-source provenance and the integrity of the preliminary report.
- Database, email, GIS, signing, and staff-access credentials.
- Provider, PDF-rendering, database, and email capacity.

## Testable security acceptance criteria

1. The workflow remains unavailable outside the declared development/test boundary unless a separately reviewed production access design is implemented.
2. Anonymous, malformed-credential, and non-development staff requests fail safely without disclosing assessment existence or personal data.
3. Staff list/detail and report reads are enforced server-side; direct URL or API access cannot bypass the boundary.
4. A submitted report's address, mapped evidence, pool layout, warning state, recommendations, consent version, and consent timestamp are established or authenticated by the server. Client assertions alone must not create an authoritative saved report.
5. All request bodies, path identifiers, strings, arrays, coordinates, geometries, images, and nested report structures have positive type and size bounds before database, PDF, or email work.
6. The complete construction envelope, not only the visible shell, is the persisted geometry used for containment and warning decisions.
7. Missing, unavailable, provisional, or failed evidence cannot be converted into `no_warning`; confirmed service conflicts cannot be converted out of `blocked`.
8. Duplicate/replayed submissions cannot create duplicate assessments or duplicate homeowner/ServiceM8 deliveries.
9. Expensive address, provider, database, PDF, and email operations have observable abuse controls appropriate to the reachable audience.
10. SQL is parameterized; external request destinations are fixed or allow-listed; report HTML is contextually encoded; the PDF renderer cannot make network requests.
11. Secrets, raw provider payloads, personal data, and precise property imagery do not appear in URLs, safe error bodies, application logs, browser storage, or retained test artifacts.
12. Personal data is encrypted in transit and at rest, access-controlled, minimized, and disclosed only for the stated enquiry/report purpose.
13. The collection notice identifies persistence, homeowner email delivery, ServiceM8 forwarding, relevant processors, retention, access/correction, and deletion/archival behavior before consent.
14. A defined retention period and tested archive/delete path exist before real customer data is stored; indefinite retention is not a release-ready default.
15. Delivery failure preserves the assessment, records only a safe outcome code, and does not expose provider responses or resend an already-sent destination.
16. Security-relevant denials, validation failures, delivery outcomes, and staff reads are observable without logging names, phone numbers, emails, addresses, coordinates, report content, secrets, or Basic credentials.
17. Third-party processing location and safeguards are documented before personal data is sent to Neon, Resend, or any ServiceM8 mail processor.
18. Strict E2E evidence uses an isolated non-production target, realistic non-customer fixtures, real application authorization/routing/persistence, zero retries, and the exact reviewed state.

## Abuse cases

- Forge a `no_warning` report or fake official evidence by calling the assessment endpoint directly.
- Submit another property, layout, consent time, or contact identity than the UI displayed.
- Enumerate assessment UUIDs or force-browse `/staff`, assessment detail, or PDF routes.
- Replay or race idempotency keys to duplicate records or email delivery.
- Flood assessment creation, map images, GIS requests, PDF rendering, or outbound email to exhaust capacity or incur cost.
- Inject HTML, URLs, header characters, malformed GeoJSON, huge coordinate arrays, or active image content into a stored report.
- Leak personal data or secrets through errors, logs, URLs, browser storage, Playwright traces, screenshots, or reports.
- Treat unavailable provider data as proof of clearance or omit a confirmed service conflict.
- Use a development server on a reachable interface as if it were a production homeowner application.

## Compliance and blast radius

The feature handles identifiable homeowner and residential-property information, so the
code-verifiable NZ Privacy Act 2020 profile applies. Full compromise exposes contact details,
precise property imagery and geometry, proposed construction intent, saved reports, and outbound
email capability for every retained assessment reachable with the application database
credential. Organisational privacy, breach-notification, and legal compliance remain separate
human obligations.

## Non-goals

- Production/customer launch.
- ServiceM8 API job creation.
- Engineering, consent, title, survey, utility-location, or construction-safety approval.
- Staff lifecycle editing or homeowner post-submission editing.
- Treating provider absence or an empty mapped result as proof that a real-world feature is absent.
