# pool-feasibility-nz

`pool-feasibility-nz` is a standalone Auckland-only proof of concept for generating preliminary residential swimming-pool feasibility reports from official mapped information and deterministic spatial analysis.

The product is a desktop screening tool, not an approval, consent, engineering, title, utility-location, or construction-safety service. It must report unknown information as unknown and must never replace missing GIS data with invented geometry or findings.

## Current status

Stage 1 is complete and the bounded Stage 2 official-data spike is implemented. The spike accepts a supplied Auckland address, performs LINZ address/parcel matching, and probes the allow-listed datasets. It is not yet the public address-entry flow and does **not** implement candidate generation, scoring, report retrieval, or PDF generation.

Later implementation remains gated on review of [the architecture](docs/architecture.md), [the verified data-source register](docs/data-sources.md), and [the implementation stages](docs/implementation-plan.md). Authenticated LINZ aerial verification has passed; Auckland Council generated-report reuse remains conditional.

## Technology baseline

- Next.js App Router, React, strict TypeScript, Tailwind CSS, and shadcn/ui
- MapLibre GL JS, Turf.js, and Zod
- PostgreSQL using Drizzle ORM and a Vercel-compatible serverless driver
- Vitest, Testing Library, and Playwright
- ESLint and Prettier

Exact installed versions are recorded in `package-lock.json`. See [dependencies](docs/dependencies.md) for the role of each package and deferred decisions.

## Local setup

Prerequisites:

- Node.js 24 or a supported active-LTS release compatible with the locked dependency tree
- npm 11+
- A PostgreSQL database when database-backed work begins

```bash
npm install
copy .env.example .env.local
npm run dev
```

The current scaffold can build without importing database-backed application modules. Once Stage 2 code uses validated server configuration, `DATABASE_URL` will be required.

## Environment variables

Copy `.env.example` to `.env.local`. All GIS, database, rate-limit, storage, and optional AI credentials are server-only. No provider key may be exposed with a `NEXT_PUBLIC_` prefix unless Stage 2 proves that the provider explicitly intends the key to be public and its licence permits the proposed use.

See [environment variables](docs/architecture.md#environment-boundary) for the proposed contract.

## Quality commands

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

Playwright configuration is present, but the required report journey is a later-stage fixture-backed test:

```bash
npm run test:e2e
```

## Database

The proposed PostgreSQL model is documented in [database.md](docs/database.md). Schema and migrations are deliberately deferred until the plan is approved.

Planned commands:

```bash
npm run db:generate
npm run db:migrate
npm run db:studio
```

## Test property

The application is designed for different Auckland property addresses. `42A Bahari Drive, Ranui, Auckland` is only the first proof fixture. Stage 2 must prove that the reusable address resolver and parcel-matching process distinguish it from `42 Bahari Drive` and from neighbouring or parent parcels; the fixture must never become a fixed product input.

Run the internal spike with an explicit address:

```bash
npm run spike:data-access -- "42A Bahari Drive, Ranui, Auckland"
npm run spike:verify-aerial -- "42A Bahari Drive, Ranui, Auckland"
```

The aerial verifier accepts any supported address, performs the same live
address/parcel resolution, checks point-in-parcel alignment, loads real LINZ
aerial tiles, and saves a local verification screenshot under `output/playwright/`.
It is an internal data-access check, not a pool-feasibility finding.

Generic verification screenshots can contain a full residential address and
precise imagery, so they are ignored by Git and should be deleted after the local
check. Only the approved `2359811-aerial-alignment.png` regression artifact is
eligible for retention in this POC repository.

There is deliberately no default property. Standard street addresses and LINZ-style
unit forms such as `2/49 Pigeon Mountain Road, Half Moon Bay, Auckland` are accepted
by the spike lookup. The later user interface will add address suggestions and an
explicit ambiguity-selection step.

## Deployment

The target is Vercel with a serverless-compatible PostgreSQL provider. PDF rendering, aerial-tile credential delivery, rate limiting, and durable PDF storage remain explicit deployment decisions to validate before implementation.

## Planning documents

- [Architecture](docs/architecture.md)
- [Dependencies](docs/dependencies.md)
- [Database proposal](docs/database.md)
- [Data-source investigation](docs/data-sources.md)
- [Scoring](docs/scoring.md)
- [Report format](docs/report-format.md)
- [Limitations](docs/limitations.md)
- [Regional expansion](docs/regional-expansion.md)
- [Implementation plan](docs/implementation-plan.md)
