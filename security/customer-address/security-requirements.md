# Security requirements - customer-address

- Mode: authenticated internal POC; reviewed base `655695e2dce98dba634830bd6087d20740708fa3` plus uncommitted candidate changes.
- Authenticated POC users may submit only bounded Auckland address queries and selected LINZ address IDs.
- The existing `/api/internal/*` staff routes remain protected by server-side internal access control.
- The POC provider-backed endpoint remains behind the existing login/internal access boundary, with explicit method handling, schema validation, response-size limits, and timeout/retry bounds. Distributed rate limiting is out of scope for this authenticated POC.
- Provider failures, empty results, ambiguous addresses, and unconfirmed parcels must produce safe stable states; none may be represented as confirmed property data.
- Responses must not expose provider URLs, credentials, raw payloads, stack traces, or unnecessary personal data.
- Address and parcel data must be used only for preliminary screening and must not be persisted by this ticket.
- The authenticated flow must be keyboard accessible and visibly distinguish confirmed, manual review, not found, loading, and provider-error states.
- Abuse of the endpoint must not allow unbounded LINZ traffic, denial of service, address enumeration at an unacceptable rate, or bypass of internal report authorization.
- Out of scope: report persistence, email delivery, authenticated customer accounts, building-code approval, title/legal advice, and external release authorization.

## Current security decision

This is not an anonymous public endpoint in the POC. The existing autocomplete and assessment routes remain login-protected; the implementation must not remove that authorization check. Anonymous customer access and distributed rate limiting are deferred to a later release boundary.
