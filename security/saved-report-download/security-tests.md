# Security tests - saved report download and delivery

## Executed on 2026-08-10

| Check                                             | Command or probe                                                                                                                                                                                                                                           | Result                                      | Security meaning                                                                                                                             |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Token, route, delivery, limiter and PDF unit lane | `npm.cmd test -- --configLoader runner tests/unit/saved-report-access-token.test.ts tests/unit/public-saved-report-route.test.ts tests/unit/assessment-report-delivery.test.ts tests/unit/public-rate-limit.test.ts tests/unit/preliminary-report.test.ts` | PASS - 5 files, 33 tests                    | Useful local regression evidence; route collaborators are mocked and it is not strict E2E                                                    |
| Diagnostic browser journey                        | `npx.cmd playwright test tests/e2e/homeowner-report.spec.ts --project=chromium --workers=1 --retries=0`                                                                                                                                                    | PASS - 1 test                               | UI/download wiring only; assessment, delivery and PDF routes are intercepted                                                                 |
| Type safety                                       | `npm.cmd run typecheck`                                                                                                                                                                                                                                    | PASS                                        | No TypeScript errors                                                                                                                         |
| Lint                                              | `npm.cmd run lint`                                                                                                                                                                                                                                         | PASS with one pre-existing vendored warning | Zero errors; one `public/prototype-assets/vendor/maplibre-gl.js` warning                                                                     |
| Production build                                  | `npm.cmd run build`                                                                                                                                                                                                                                        | PASS                                        | Next 16.2.12 compiled and emitted all report routes; not deployment proof                                                                    |
| Production dependency advisory                    | `npm.cmd audit --omit=dev --json`                                                                                                                                                                                                                          | FAIL                                        | 3 high and 1 moderate production advisories; Next 16.3.0 offered as fix                                                                      |
| Unicode signature differential                    | 43 multibyte characters passed JS character-length parity then reached `timingSafeEqual`                                                                                                                                                                   | FAIL reproduced                             | `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH` (86 supplied bytes vs 43 expected); routes convert this malformed token to generic 502 rather than 401 |
| Active-scheme URL validation                      | `z.url().safeParse()` for `javascript:` and `data:`                                                                                                                                                                                                        | FAIL reproduced                             | Both schemes are accepted; saved URLs require positive protocol/host validation before browser/PDF links                                     |
| Secret filenames and local environment names      | `.gitignore`, `git ls-files`, environment-key-name-only scan                                                                                                                                                                                               | PASS in bounded scan                        | `.env*` ignored, only `.env.example` tracked, values not printed; local delivery keys absent                                                 |

## Existing positive cases inspected

- HMAC issue/verify, expiry and ordinary ASCII tampering.
- Invalid token and cross-object reference denial before PDF render.
- Strict unknown-field rejection and 16 KB request cap on PDF route.
- Independent delivery claims, failures, retries and provider idempotency.
- Local and production rate-limit fail-closed behavior at unit/code boundary.
- `application/pdf`, attachment disposition, safe filename, `nosniff` and `no-store` response headers.

## Missing required security tests

- Real-boundary expired, Unicode, non-canonical, wrong-family and wrong-purpose token cases.
- Real cross-object/deleted-object database authorization.
- Real managed-store multi-instance limits and distributed same-token replay.
- Real renderer/provider failure isolation and PDF-link scheme inspection.
- Real concurrent delivery with disposable persistence and dedicated email capture.
- Anti-automation/email-ownership behavior and ServiceM8-disabled production-like configuration.
- Token/PII absence from logs, URL, browser storage and retained evidence artefacts.
