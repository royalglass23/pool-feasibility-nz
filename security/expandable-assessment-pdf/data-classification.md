# Data classification - expandable-assessment-pdf

| Data                                                       | Classification                                        | At rest                                      | In transit                                         | Retention                        | Logging / notes                                                             |
| ---------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------- | -------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------- |
| Staff Basic username/password                              | Secret credentials                                    | Environment/secret configuration only        | Authorization header over the deployment transport | Until rotated                    | Must never enter report HTML, responses, URLs, or logs                      |
| Provider/API keys                                          | Secret credentials                                    | Environment only                             | Server-to-provider HTTPS outside PDF rendering     | Until rotated                    | Not used by the PDF route and must not be serialized client-side            |
| Residential address and LINZ address ID                    | Personal / internal                                   | Browser memory only                          | Internal API JSON and PDF request                  | Current browser session          | Must not be logged; appears intentionally in the downloaded report          |
| Parcel ID/appellation                                      | Internal, potentially personal when linked to address | Browser memory only                          | Internal API JSON and PDF request                  | Current browser session          | Report content; no durable server copy                                      |
| Score, recommendation, risks, actions, missing information | Internal                                              | Browser memory only                          | Internal API JSON and PDF request                  | Current browser session          | Do not log report content                                                   |
| Map PNG with parcel/property context                       | Personal / internal                                   | Browser memory and transient renderer memory | PDF request body                                   | Request lifetime only            | Largest sensitive payload; no logs, traces, screenshots, or durable storage |
| Dataset provenance, licences, attribution                  | Public/internal mix                                   | Browser memory only                          | PDF request                                        | Current browser session          | Evidence-use classification must be preserved                               |
| Generated PDF                                              | Personal / internal                                   | User-selected local download only            | Response body                                      | Not retained by server           | `no-store`; user controls local retention                                   |
| Correlation ID                                             | Internal operational metadata                         | Logs if logging is added                     | Request/response header                            | Normal operational log retention | Bounded safe character set; must not encode personal data                   |
| Browser/PDF errors                                         | Internal operational metadata                         | Logs only if explicitly emitted              | Safe response code/message                         | Normal operational log retention | No raw submitted data, stack trace, filesystem path, or secret              |

## Trust boundaries and exposure paths

1. Browser to `/api/internal/data-access`: existing normalized assessment result enters the staff session.
2. Browser to `/api/internal/report/pdf`: current implementation retransmits the assessment and map; both are untrusted at this boundary.
3. Route to Playwright Chromium: validated self-contained HTML crosses into a high-resource renderer process.
4. Chromium to PDF response: transient bytes return to the authenticated browser with no server persistence.

## Minimisation and retention requirements

- Do not add a report database, browser local storage, server cache, blob storage, analytics payload, or raw request logging in this POC.
- Include only report fields required by the three-page contract; omit raw geometry, provider payloads, API keys, timing details, and hidden attributes.
- Keep `Cache-Control: no-store` on success and all error paths.
- Treat traces/screenshots from controlled tests as temporary evidence and never use live residential payloads beyond the already-approved fixtures.
