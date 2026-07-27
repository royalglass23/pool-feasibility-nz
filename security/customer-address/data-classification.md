# Data classification - customer-address

| Data | Classification | At rest | In transit | Retention | Notes |
|---|---|---|---|---|---|
| Typed street address | Personal / property-related | Not persisted by this ticket | HTTPS required in deployment | Request lifetime | May identify a household; do not log raw values. |
| LINZ address ID | Personal-adjacent identifier | Not persisted by this ticket | HTTPS required | Request lifetime | Preserve only for the current selection flow. |
| Full address returned by LINZ | Personal / property-related | Not persisted by this ticket | HTTPS required | Request lifetime | Return only the minimum display fields. |
| Parcel ID and parcel status | Personal / property-related | Not persisted by this ticket | HTTPS required | Request lifetime | Status is preliminary screening, not legal confirmation. |
| Provider response geometry | Internal/provider data | Not persisted by this ticket | Server-side provider TLS | Request lifetime | Must not be sent to the customer-address endpoint unless required. |
| Provider API keys | Secret | Server secret store | Server-side TLS | Managed by deployment | Never sent to browser or response. |
| Correlation ID | Internal metadata | Operational logs only if safe | Response header/body | Per logging policy | Must not contain address data. |

No name, phone, email, consent, or report history is required for this ticket. The NZ Privacy Act 2020 applies because an address can be personal information when associated with an identifiable household; purpose limitation, minimisation, security, and retention controls remain required.
