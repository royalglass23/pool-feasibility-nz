# PoolReady

PoolReady is an Auckland-first property discovery tool for early swimming-pool
conversations. A homeowner or pool professional can find a property, position
an indicative pool shell, inspect available mapped constraints, and request a
preliminary feasibility report.

The result is a screening aid, not an approval, quote, design, survey,
engineering opinion, title review, utility-location service, or confirmation
that a pool can be built. Missing evidence remains **Needs checking**; the
application must not turn unavailable data into a clear result.

## Start here

- Product and domain language: [`CONTEXT.md`](CONTEXT.md)
- What changed: [`CHANGELOG.md`](CHANGELOG.md)
- Documentation map: [`docs/README.md`](docs/README.md)
- Architecture and trust boundaries: [`docs/architecture.md`](docs/architecture.md)
- Current validation and release evidence: [`docs/release-readiness.md`](docs/release-readiness.md)

## What exists now

The current `features` branch contains:

- an anonymous Auckland Property Check journey at `/`;
- indexed LINZ address suggestions and official parcel/aerial evidence;
- interactive pool-size, placement, and rotation controls;
- an opt-in detailed constraint check with deterministic overlap reporting;
- preliminary web reports and server-rendered PDF email attachments;
- persisted assessment requests backed by PostgreSQL/Neon;
- an Admin-only Staff Workspace at `/staff` for saved assessments;
- privacy controls, scheduled retention, shared public rate limits, and
  consent-gated analytics;
- public information pages and a BlueHaven-backed Founding Partner Program at
  `/partners`; and
- privacy-safe general and partnership enquiry forms.

Browser PDF download controls were removed on 8 September 2026. The supported
visitor flow is to request the report by email; staff can review saved records
through the protected workspace.

This repository is no longer the session-only, no-database POC described by the
old README. Some documents under `docs/` and `security/` deliberately preserve
earlier proposals or point-in-time audit evidence. Read their date and reviewed
commit before treating them as current.

## Current delivery boundary

The codebase is shaped for a public Auckland discovery site, but repository
state is not proof of the live environment. Deployment, production database
migrations, provider credentials, email delivery, DNS, analytics collection,
and security sign-off must each be verified separately for the exact target and
commit.

The latest dependency-remediation evidence passes for commit `5e34e16`. The
current branch also contains later form-feedback changes, so there is not yet a
single complete release-evidence pack bound to `HEAD`. See
[`docs/release-readiness.md`](docs/release-readiness.md) before promoting a
build.

## Main journeys

| Route                                   | Audience                          | Purpose                                                                               |
| --------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------- |
| `/`                                     | Homeowners and pool professionals | Find a property, position a pool, check constraints, and request a preliminary report |
| `/auckland-pool-planning-for-builders`  | Pool professionals                | Explain the early builder conversation                                                |
| `/can-my-auckland-property-suit-a-pool` | Search/discovery visitors         | Explain the Auckland property-check use case                                          |
| `/partners`                             | Prospective industry partners     | Founding Partner Program and enquiry form                                             |
| `/privacy`                              | Public visitors                   | Privacy information and request guidance                                              |
| `/staff`                                | Provisioned Admin                 | Search and review saved assessments                                                   |

Public pages and `/api/public/*` are anonymous by design. Staff pages and saved
assessment reads require the database-backed Admin session. The older
`/api/internal/*` endpoints are diagnostic seams protected by separate legacy
credentials; they are not the public browser journey.

## Technology

- Next.js 16.3, React 19, strict TypeScript, Tailwind CSS, and Base UI
- MapLibre GL JS and Turf.js for the mapped property experience
- PostgreSQL/Neon with Drizzle ORM for address indexing, assessments, and staff
  access
- Puppeteer Core with `@sparticuz/chromium` for PDF rendering
- Resend for report and enquiry email delivery
- Upstash Redis-compatible rate limiting for deployed public routes
- Vitest, Testing Library, Playwright, ESLint, and Prettier

Exact versions are locked in `package-lock.json` and `pnpm-lock.yaml`. The npm
lockfile is the documented local workflow; the pnpm lockfile is retained and
validated for Vercel installs.

## Local setup

Use Node.js 24 (the current verified development baseline) and npm 11 or a
compatible release.

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open <http://localhost:3000>. The app can start without production credentials,
but live property data requires LINZ and Auckland Council keys. Saving reports,
staff access, and the local address index require an explicitly approved
database target. Real email delivery requires an approved Resend configuration.

Do not copy a production database URL into local test configuration. Database
migrations, production address-index imports, credential provisioning, and
external email tests are separate authorised operations.

## Environment configuration

Use [`.env.example`](.env.example) as the inventory. Important groups are:

- application URL, analysis version, logging, provider timeout, and indexing;
- server-only LINZ and Auckland Council credentials;
- `DATABASE_URL`, with separate guarded preview/production address-index
  variables;
- Upstash REST credentials, required for deployed public routes;
- report-signing, Resend, sender, and delivery-mode settings;
- Admin bootstrap/reset inputs supplied interactively, never committed; and
- optional GA4 and Hotjar identifiers, both still gated by visitor consent.

See [`docs/staff-admin-access.md`](docs/staff-admin-access.md),
[`docs/public-rate-limiting.md`](docs/public-rate-limiting.md), and
[`docs/analytics-and-search.md`](docs/analytics-and-search.md) for operational
details.

## Common commands

```powershell
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm run test:e2e
npm run test:e2e:contact
```

Live GIS checks are manual operational evidence, not CI fixtures:

```powershell
npm run smoke:live-layers -- "42A Bahari Drive, Ranui, Auckland"
npm run spike:verify-aerial -- "42A Bahari Drive, Ranui, Auckland"
```

Address-index and Admin commands can mutate the configured database. Read the
relevant guide and confirm the target before running them:

```powershell
npm run addresses:status
npm run addresses:probe -- "42A Bahari Drive, Ranui, Auckland"
npm run staff:bootstrap
npm run staff:reset-password
```

The production address-index commands contain an additional explicit guard;
their presence is not permission to run them.

## Architecture in one paragraph

PoolReady is a modular Next.js monolith. Route handlers are thin adapters.
Official provider responses are validated and normalised before the domain
layer uses them. Deterministic spatial analysis, scoring, confidence, risks,
and recommendations operate on internal evidence models. A completed assessment
is persisted as a versioned snapshot and reused by the web report, map capture,
PDF renderer, email delivery, and staff view; report rendering does not repeat
live GIS analysis.

## Project rules

- Auckland is the supported assessment region; address search may recognise
  wider LINZ coverage without implying regional assessment support.
- Unknown or unavailable evidence is shown as unknown/Needs checking.
- Provider keys, raw payloads, stack traces, personal data, and report content
  must not enter public errors, analytics, or routine logs.
- Public limits run before provider calls, database writes, PDF work, or email
  delivery.
- Generated screenshots may contain residential information and are local-only
  unless explicitly approved as a fixture.
- No document in this repository grants authority to migrate, deploy, send live
  customer email, or widen the audience.
