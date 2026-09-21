# Threat model — complete constructability journey

## Flow and trust boundaries

```text
Untrusted browser
  -> public Property Check and Site-answer APIs
  -> signed assessment snapshot
  -> public assessment save
  -> development PostgreSQL for E2E / configured application database at runtime
  -> saved report returned to the requesting browser

Royal Glass staff browser
  -> server-rendered staff route session check
  -> authenticated internal assessment API
  -> saved report and constructability projection
```

External GIS and delivery providers sit behind server adapters. RG-345 browser tests mock provider boundaries but keep application routing, staff authorization, persistence, and serialization real.

## STRIDE assessment

| Threat | Asset | Attack | Existing mitigation and evidence | Residual risk |
|---|---|---|---|---|
| Spoofing | Staff identity | Forged or missing `rg_staff_session` | Server hashes and checks sessions in `staff-session.ts`; anonymous direct routes are redirected in Playwright | Low; credential provisioning remains an operational control |
| Tampering | Constructability snapshot | Change depth, Site answers, or route after signing | HMAC assessment token, schema validation, and server comparison; unit and E2E journey tests | Low |
| Repudiation | Submission and privileged read | Deny which evidence was saved or viewed | Saved submission-time report and provider provenance; staff view is read-only | Medium; staff read events are not separately audited in this ticket |
| Information disclosure | Contact/property data | IDOR or anonymous staff API read | Auth check at page and API data boundary; anonymous tests and synthetic authenticated E2E | Low in single-admin v1; no tenant model exists |
| Denial of service | Public provider/report endpoints | Repeat expensive provider or PDF operations | Existing public rate-limit tests and provider timeout handling | Medium; deployment Redis availability remains operational |
| Elevation of privilege | Staff modification | Add or invoke correction/override controls | RG-344 UI contains no mutation controls; RG-345 asserts their absence | Low for v1 |
| Insecure test target | Release evidence | Reuse port 3000 and test a different product or write to production | Dedicated port 3100 and explicit `DATABASE_URL_DEV` mapping in Playwright config | Low |
| Test residue | Staff session and PII | Failed test leaves a valid session or record | Unique identifiers and exact `finally` cleanup | Low; abrupt process termination can still require development-DB housekeeping |

No unmitigated High or Critical threat was found. The remaining release-evidence risk is that the candidate is uncommitted, so its E2E evidence cannot yet be bound to an immutable Git commit.
