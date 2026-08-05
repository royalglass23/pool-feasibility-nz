# Data classification - public-lead-capture

| Data | Classification | At rest | In transit | Retention | Notes |
| --- | --- | --- | --- | --- | --- |
| Name, phone, email | Personal data | `homeowner_assessments` after migration | HTTPS required; Resend email | Unbounded today | Required for report delivery; no public analytics use permitted. |
| Checked address, coordinates, boundary, pool layout, map/report | Personal data / sensitive property context | Assessment JSONB and map field | HTTPS; GIS and report boundaries | Unbounded today | Exact address must remain server-sourced from the signed snapshot. |
| Visitor type, timing, Other details, additional info | Personal data | Assessment columns | HTTPS; delivery emails | Unbounded today | Lead context; not a marketing profile. |
| Consent version/time | Personal data / audit data | Assessment columns | HTTPS | Unbounded today | Server establishes the recorded version/time. |
| Assessment snapshot and HMAC signature | Confidential integrity token | Browser memory during 15-minute lifetime | HTTPS | 15 minutes | Must not be logged or placed in URLs. |
| Internal credentials, database URL, GIS and email API keys | Secret | Environment/secret store only | Server-to-server TLS | Platform policy | No `NEXT_PUBLIC_` exposure found in runtime source. |

## Current gaps

There is no executable retention, delete, access, correction, processor disclosure, or at-rest encryption evidence for the intended public launch. Those gaps block public collection of this data.
