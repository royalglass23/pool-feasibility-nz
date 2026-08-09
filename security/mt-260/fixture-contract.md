# Isolated fixture contract - MT-260

This contract describes the only environment that can support a PASS. It does not authorise provisioning, migration, delivery, or deletion.

| Fixture                             | Required boundary                                                                                             | Current state on 2026-08-10                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `MT260_DATABASE_URL`                | Empty/disposable non-production PostgreSQL database with reviewed migrations; identity verified before writes | Missing                                                 |
| MT-260 Staff Admin credentials      | Dedicated 14+ character fixture password and disposable account/session rows                                  | Missing                                                 |
| MT-260 Upstash-compatible URL/token | Non-production distributed store namespace dedicated to the zero-retry lane                                   | Missing; ordinary `UPSTASH_REDIS_REST_*` keys are empty |
| MT-260 homeowner delivery capture   | Dedicated test recipient/capture API that can inspect PDF metadata and body without real customers            | Missing                                                 |
| MT-260 ServiceM8 delivery capture   | Dedicated capture destination that exposes the minimized notification payload                                 | Missing                                                 |
| `MT260_CRON_SECRET`                 | Dedicated retention route credential, separate from production                                                | Missing                                                 |
| Disposable retention rows           | At least one older-than-12-month row, one newer row, and one active-delivery row unique to the run            | Missing                                                 |
| Production-build Playwright harness | One worker, Chromium, zero retries, trace on failure, real app/auth/persistence/routing                       | Missing                                                 |

The checkout has ordinary `DATABASE_URL`/`DATABASE_URL_DEV` values, but target identity and MT-260 authorization were not supplied. They were not used. Provider credentials and production/customer data were not read or mutated.
