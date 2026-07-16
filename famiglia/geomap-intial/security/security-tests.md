# Security-focused tests — Job 01

| Check                                 | Result         | Evidence                                                                                         |
| ------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------ |
| Full controlled suite                 | PASS           | `npm test -- --run`: 14/14 across 3 files                                                        |
| Missing/malformed CLI input           | PASS           | Stable `ADDRESS_REQUIRED` / `ADDRESS_FORMAT_UNSUPPORTED`, exit 1, no stack trace                 |
| Wrong parcel and parcel ambiguity     | PASS           | 42A/42 regression plus `PARCEL_AMBIGUOUS` fail-closed test                                       |
| Unit/multi-title overclaim prevention | PASS           | Returns `containing_parcel_requires_confirmation`                                                |
| Provider timeout                      | PASS           | Stable `PROVIDER_TIMEOUT` adapter test                                                           |
| Provider error secret redaction       | PASS           | Credential-bearing upstream text absent from structured result                                   |
| Unknown-length response flooding      | PASS           | Stream is cancelled before all chunks are consumed                                               |
| Oversized parcel geometry             | PASS           | 5,001-vertex ring returns `PROVIDER_RESPONSE_INVALID`                                            |
| Filesystem path traversal             | PASS           | `../../outside` returns `VERIFICATION_ARTIFACT_ID_INVALID`                                       |
| Council/Watercare evidence misuse     | PASS           | Council remains `spike_only`; Watercare remains unavailable                                      |
| Outbound URL control                  | PASS by design | Public gateway operations construct fixed URLs; origin allow-list rejects any internal deviation |
| Credential/debug scans                | PASS           | Zero credential value, hardcoded-secret, or debug hits                                           |
| Authentication/authorization/IDOR     | N/A            | Internal local CLI exposes no protected resource                                                 |
| Public rate limiting                  | N/A            | No public endpoint; fixed bounded fan-out and five-alternative cap apply                         |
| Browser security journey              | N/A            | No public product UI/API exists in Job 01                                                        |

The real official-provider/aerial run remains manual evidence; automated tests use
controlled licence-permitted fixtures and never depend on live GIS services.
