# E2E matrix - customer-address

The POC flow is authenticated through the existing internal login boundary. Anonymous access and distributed rate limiting are deferred.

| Requirement or threat | Actor and boundary | Journey or abuse case | Test | Expected result | Required |
|---|---|---|---|---|---|
| AC-1 | Authenticated POC user -> internal route | Type three or more characters | `tests/e2e/data-access-inspector.spec.ts` | Bounded LINZ suggestions appear | yes |
| AC-2 | Authenticated POC user -> internal route | Select suggestion | `tests/unit/data-access-inspector.test.tsx` | Full address and selected ID are preserved | yes |
| AC-3 | Authenticated POC user -> internal route | Confirm valid parcel | `tests/e2e/data-access-inspector.spec.ts` | Confirmed status is visible | yes |
| AC-4 | Authenticated POC user -> internal route | Empty, ambiguous, and unconfirmed parcel | `tests/unit/data-access-request.test.ts`, `tests/e2e/data-access-inspector.spec.ts` | Not found/manual-review states are explicit | yes |
| AC-5 | Authenticated POC user -> internal route | Provider timeout/failure | `tests/unit/data-access-inspector.test.tsx` | Safe provider error and retry state appear | yes |
| AC-6 | Authenticated POC user -> internal route | Keyboard-only autocomplete | `tests/unit/data-access-inspector.test.tsx` | Suggestions are operable and announced | yes |
| SEC-1 | Unauthenticated -> staff boundary | Direct request to internal address/data routes | `tests/unit/internal-address-suggestions-route.test.ts`, `tests/unit/internal-data-access-route.test.ts` | Unauthenticated request is denied | yes |
| SEC-2 | Authenticated POC user -> internal route | Oversized, malformed, injection-shaped input | `tests/unit/internal-data-access-route.test.ts`, `tests/unit/internal-address-suggestions-route.test.ts` | Rejected safely without provider call or echo | yes |
| SEC-3 | Authenticated POC user -> internal route | Rate limiting | Deferred by POC scope | Not applicable until anonymous release | no |
| SEC-4 | Authenticated POC user -> browser artifacts | Inspect URL, DOM, storage, logs, traces | `tests/e2e/data-access-inspector.spec.ts` | No unnecessary PII or secrets leak | yes |
