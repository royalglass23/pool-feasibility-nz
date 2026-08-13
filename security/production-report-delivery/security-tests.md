# Security tests - production report delivery

## Static/code-boundary evidence reviewed

| Check                                                                    | Result                                          | Evidence                                                                                                        |
| ------------------------------------------------------------------------ | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Explicit mode/environment policy fails closed before claim/render/send   | PASS at unit boundary                           | `report-delivery-policy.ts`, `report-delivery-policy.test.ts`                                                   |
| Report route body cap, strict schema and object-bound token verification | PASS at code boundary                           | `src/app/api/public/assessments/report/delivery/route.ts`                                                       |
| Per-IP report-delivery rate limit before expensive work                  | PASS at code boundary                           | `src/modules/rate-limit/public-rate-limit.ts`, `docs/public-rate-limiting.md`                                   |
| Durable claim and provider idempotency seam                              | PASS at code/unit boundary                      | `homeowner-assessment-repository.ts`, `assessment-report-delivery.test.ts`                                      |
| Production homeowner-only destination                                    | PASS at unit boundary                           | Production policy claims only `homeowner`; regression verifies no internal channel claim                        |
| Recipient verification before Production send                            | PASS at unit/API boundary                       | Fragment-bound signed one-hour verification token; invalid and cross-record tokens deny before delivery         |
| Production mode/environment configuration matrix                         | PASS at unit boundary                           | `production` requires Vercel Production, while `synthetic_test` is Preview/local test only                      |
| Resend/provider configuration without secret exposure                    | BLOCKED                                         | Vercel Production variables and account values were not read or changed                                         |
| Safe correlation outcome logging                                         | PASS at code boundary; runtime evidence BLOCKED | delivery and verification routes log event/outcome/reason/correlation only; safe Vercel-log fixture unavailable |
| Real renderer/provider error isolation                                   | BLOCKED                                         | Production was observed to 502, but the isolated renderer/provider capture lane is unavailable                  |
| Strict E2E / security lane                                               | BLOCKED                                         | Matrix has zero executable required rows                                                                        |

## Manual pentest status

- BOLA/cross-record token, replay/concurrency, recipient-spoofing, rate-limit, renderer failure, and log/trace-leak probes require the missing isolated fixture.
- No production mutation, customer data, real email, account inspection, or destructive test was performed.
