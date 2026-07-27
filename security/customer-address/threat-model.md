# Threat model - customer-address

## Flow and trust boundaries

```text
Authenticated POC browser
  -> login/internal access boundary
  -> bounded address UI and route
  -> server-side validation
  -> OfficialGisGateway
  -> allow-listed LINZ endpoints
  -> minimum normalized status response

Staff browser
  -> proxy/internal access control
  -> /api/internal/* routes
```

The authenticated internal route is the existing trust boundary. It must not be made anonymous or bypass the staff login.

## STRIDE threats

| ID | Threat | Impact x likelihood | Existing mitigation | Residual risk / action |
|---|---|---:|---|---|
| T1 | Spoofing or forced access to staff assessment/report routes | High x Medium | `proxy.ts` and `authorize-internal-request.ts` enforce staff Basic auth outside loopback development | Preserve unchanged; required E2E direct-route denial. |
| T2 | Denial of service through repeated provider-backed queries | Medium x Medium | Login boundary, query length, provider timeout, response limits exist in the internal seam | Distributed rate limiting is deferred because this is an authenticated POC; reassess before anonymous release. |
| T3 | SSRF through provider URL manipulation | High x Low | `OfficialGisGateway` uses configured provider URLs and allow-list checks | Verify the internal route does not accept provider URLs or arbitrary datasets. |
| T4 | Injection into ArcGIS query | High x Medium | Zod bounds and `escapeArcGisText` in gateway | Add internal endpoint malformed/injection-shaped tests. |
| T5 | Information disclosure via raw provider/error response | Medium x Medium | Existing routes return stable safe error shapes | Internal route must map all errors and avoid raw geometry/provider fields. |
| T6 | Tampering selected address ID to confirm another result | Medium x Medium | Confirmation must resolve selected ID only from current bounded result set | Add cross-selection and stale-ID tests. |
| T7 | Enumeration of residential addresses | Medium x Low | Login boundary and provider response minimisation | Reassess with anonymous access; rate limiting is deferred for the POC. |
| T8 | Misleading unconfirmed parcel shown as confirmed | High x Medium | Existing domain distinguishes parcel match status; proposed confirmation module fails closed | Add focused tests and customer-visible status E2E. |
| T9 | PII leakage in logs, URLs, traces, or artifacts | High x Medium | Correlation ID mechanism; no persistence in ticket | Redact addresses and inspect browser/server artifacts. |

T1 is protected only while the current internal boundary remains intact. T2 and T7 remain deferred risks for any future anonymous/customer release.
