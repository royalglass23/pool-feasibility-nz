# Security requirements - expandable-assessment-pdf

- Mode: retrofit
- Repository: `D:\Royal Glass Dev\geomap`
- Reviewed commit: `e47f4e6fd28a6ca4249f5d1a189c32ba6ad06933`
- Target environment: local/internal Auckland-only POC; no deployment or external/customer use
- Authorization boundary: loopback development bypass; otherwise paired Royal Glass staff Basic credentials enforced by proxy and route

## Actors

| Actor                    | Trust                                     | Allowed behavior                                                                                                                    |
| ------------------------ | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Royal Glass staff member | Authenticated but input remains untrusted | Run one bounded assessment, inspect it, preview it, and download the matching preliminary PDF                                       |
| Unauthenticated caller   | Untrusted                                 | Receive no assessment or PDF data                                                                                                   |
| Browser/session script   | Untrusted                                 | Present the current session result, but must not be able to change authoritative report facts                                       |
| GIS/aerial provider      | External boundary                         | Supply already-normalized assessment/map evidence through the existing bounded provider seams; never be called during PDF rendering |
| PDF renderer process     | Privileged internal component             | Render one bounded, self-contained document without network access or indefinite resource consumption                               |

## Protected assets

- Staff credentials and provider/API secrets.
- Residential address, parcel identity, map capture, assessment findings, risks, and actions.
- Integrity of the PDF's address, parcel, score, evidence classifications, limitations, and provenance.
- Availability of the internal Next.js process and host CPU/memory.
- Licence classifications: LINZ `report_allowed`, Auckland Council `spike_only`, Watercare `internal_reference`.

## Testable security acceptance criteria

1. The PDF route returns `401` without valid deployed credentials and fails closed with `503` when credentials are not configured; loopback bypass is development-only.
2. The PDF route never trusts caller-controlled report facts without a server-verifiable snapshot or equivalent integrity control.
3. Every report field is schema-validated with bounded strings, arrays, enums, dates, and numeric ranges before HTML generation.
4. The map input is a bounded, syntactically valid PNG data URL; remote URLs, alternate media, malformed base64, and oversized decoded images are rejected.
5. All report text is HTML-escaped and the renderer cannot make live network requests.
6. Raw request bodies are bounded before JSON parsing; malformed and injection-shaped inputs return safe errors without echoing input or stack traces.
7. Browser rendering has a hard timeout and bounded concurrency so repeated authenticated requests cannot exhaust the process.
8. Successful and failed report attempts are observable by correlation ID and outcome without logging addresses, map bytes, credentials, or assessment contents.
9. Responses are `no-store`, PDF responses use `application/pdf`, a safe disposition filename, and `nosniff`.
10. The generated artifact is exactly three A4 pages and retains the preliminary/internal/no-history limitations.
11. No report generation path performs GIS/provider calls, database writes, or durable report retention.
12. Licence-limited evidence is not promoted to report-eligible evidence by the PDF workflow.

## Abuse cases

- Submit a fabricated assessment with a real address to create a misleading PDF.
- Submit deeply malformed or very large nested objects to crash or stall rendering.
- Repeatedly request PDFs to launch many Chromium processes and exhaust memory/CPU.
- Inject HTML/script/remote-resource markup through address, risk, source, or action strings.
- Upload a disguised/non-PNG payload or an oversized decompression target as the map.
- Attempt the route without credentials, with wrong credentials, or with a spoofed correlation ID.
- Cause renderer errors and use responses/logs to learn filesystem paths, secrets, or submitted residential data.

## Compliance and privacy

- A residential address and property-specific assessment may identify an individual or household and is treated as personal data for NZ Privacy Act-oriented minimisation and security review.
- The feature must remain session-only, `no-store`, and free of durable report history.
- Formal legal compliance/certification is outside this code review; only code/runtime controls are assessed.

## Failure states

- Authentication unavailable or invalid: fail closed; no PDF.
- Invalid/tampered/oversized input: safe `400` or `413`; no renderer launch.
- Renderer busy, timed out, or failed: safe unavailable error; session assessment remains visible.
- Map capture unavailable: download remains disabled and no fictional map is substituted.

## Non-goals

- External/customer release, deployment approval, durable storage, digital signatures, engineering/consent advice, or legal confirmation of third-party dataset reuse.
- Cross-tenant/owner checks: the internal POC has one staff role and no persisted owner/tenant model.

## Compromise blast radius

A full compromise could expose the current request's property assessment, create misleading preliminary PDFs, consume host resources, and expose server-only provider credentials available to the Next.js process. No report database/history exists, limiting stored-data blast radius, but process-level credential exposure remains material.
