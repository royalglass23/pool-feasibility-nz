# Threat model - production report delivery

## Data flow

```text
Anonymous browser
  -> public report request + consent -> Neon pending report
  -> recipient verification control -> verified report recipient
  -> report capability + rate-limited delivery route
  -> object-bound Neon lookup and durable homeowner claim
  -> Chromium PDF renderer -> Resend -> verified homeowner mailbox

Preview/local only:
  synthetic fixture -> same flow -> submitted synthetic address + fixed internal test mailbox
```

The browser/API edge, recipient verification, server-only secrets, Neon, Upstash, Chromium, and Resend are separate trust boundaries. Production has no path to the internal test mailbox or ServiceM8.

## STRIDE register

| ID     | Threat                 | Asset and attack                                                                        | Existing evidence                                                                                                       | Required mitigation / residual risk                                                                       | Rank                |
| ------ | ---------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------- |
| PRD-01 | Spoofing               | Attacker submits a victim mailbox and causes unsolicited report delivery                | Production sends a verification-only email first; PDF delivery requires its signed, short-lived confirmation capability | Unit/API-boundary evidence passes; isolated mailbox-capture proof remains required                        | Medium evidence gap |
| PRD-02 | Tampering / BOLA       | Alter/replay access token to read or send another report                                | HMAC, expiry, UUID/reference binding, DB match                                                                          | Strict real-boundary cross-object, expired and malformed-token tests remain required                      | High evidence gap   |
| PRD-03 | Disclosure             | Customer report is copied to the fixed internal test mailbox or ServiceM8               | Production policy claims only `homeowner`; synthetic fan-out is Preview/local-test-only                                 | Unit evidence passes; capture proof remains required                                                      | Medium evidence gap |
| PRD-04 | Replay / repudiation   | Concurrent retries duplicate an email or corrupt state                                  | Atomic claim token and Resend idempotency key                                                                           | Real disposable DB/email-capture concurrency evidence required                                            | Medium evidence gap |
| PRD-05 | DoS                    | Valid/replayed tokens exhaust renderer or Resend capacity                               | Per-IP limit, renderer busy guard, timeout                                                                              | Test direct route, multi-instance limiter and failure recovery; distributed token budget remains residual | High                |
| PRD-06 | Misconfiguration       | Wrong environment enables delivery or secrets are absent                                | Explicit mode/environment policy and configuration checks fail closed                                                   | Operator must scope Vercel variables correctly; production-shaped proof remains required                  | Medium evidence gap |
| PRD-07 | Disclosure / injection | PII, token, unsafe report HTML/link, provider error or secret leaks to browser/logs/PDF | Generic route errors, escaping, renderer blocks requests                                                                | Validate positive URL schemes, inspect live-safe logs/traces and browser response surfaces                | High evidence gap   |
| PRD-08 | Privacy                | Processor retention or cross-border safeguards are insufficient                         | Resend 30-day evidence exists; ServiceM8 gate fails                                                                     | Revalidate Resend evidence and retain ServiceM8 exclusion; IPP12 needs operator/legal evidence            | High release gate   |

## Security decisions

1. Production delivery is code-gated by a signed recipient-verification step before PDF send.
2. `synthetic_test` is Preview/local only. Production requires an explicit separate mode and homeowner-only channel set.
3. No configuration change, real email, or production database mutation is part of this review.
4. Strict production-like E2E is mandatory for PASS; unit/browser mocks cannot substitute for it.
