# Public rate limiting

The anonymous Property Check and report-request routes use a shared,
Upstash-compatible Redis store in every production and preview deployment.
This keeps limits consistent across Vercel function instances.

## Enforced boundaries

- `POST /api/public/property-check`: 10 attempts per client IP in a rolling
  30-minute window.
- `POST /api/public/assessments`: 3 attempts per client IP in a rolling
  one-hour window.
- A signed Property Check session receives two stage operations in 15 minutes:
  automatic enrichment plus the optional detailed check. The allowance is
  scoped by client IP and signed snapshot ID, so replay cannot create unbounded
  provider work and stage calls do not consume another initial Property Check
  attempt.

The rate-limit check runs before property providers, database writes, PDF work,
or email fan-out. A denied request receives HTTP `429` with
`Please try again shortly.` and a `Retry-After` header. CAPTCHA is not part of
this release.

## Deployment configuration

Set both server-only variables in each production and Vercel preview
environment:

```text
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

Do not prefix either value with `NEXT_PUBLIC_`. Production fails closed with a
calm HTTP `503` response if either credential, the trusted Vercel client-IP
header, or the managed store is unavailable. An Upstash SDK timeout is also
treated as unavailable rather than allowed.

## Local development

When `NODE_ENV=development` and the Upstash variables are empty, `next dev`
uses an enforcing process-local rolling-window store. This is suitable only for
local work. It is deliberately unavailable when `NODE_ENV=production`, so a
Vercel deployment cannot silently fall back to per-instance memory.

To exercise the distributed path locally, set both Upstash variables to a
dedicated non-production database or an Upstash-compatible local REST service.
Never point automated tests at the production rate-limit database.

## Privacy and observability

The Redis identifier is a SHA-256 digest of the platform-provided client IP.
Structured `public_rate_limit` events record only the action, outcome, HTTP
status, and correlation ID. They do not include IP addresses, property data,
coordinates, contact details, or report content. Upstash rate-limit analytics
are disabled for this application.
