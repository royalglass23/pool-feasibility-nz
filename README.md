# pool-feasibility-nz

`pool-feasibility-nz` is a standalone Auckland-only proof of concept for generating preliminary residential swimming-pool feasibility reports from official mapped information and deterministic spatial analysis.

The product is a desktop screening tool, not an approval, consent, engineering, title, utility-location, or construction-safety service. It must report unknown information as unknown and must never replace missing GIS data with invented geometry or findings.

## Current status

The internal Auckland POC now covers the complete session journey: exact LINZ
address and parcel selection, official mapped evidence and attribution,
deterministic multi-scenario candidates and calculated shell range, feasibility
score, separate data confidence, sourced risks and ordered actions, optional
constrained AI explanation with deterministic fallback, and an immediate JSON
session-assessment download.

It remains an **internal-only, no-database, session-scoped POC**. It is not
deployed, does not retain assessments, and does not generate a durable or public
PDF report. See [release readiness](docs/release-readiness.md) for the current
GO/BLOCKED decision and validation evidence.

## Technology baseline

- Next.js App Router, React, strict TypeScript, Tailwind CSS, and shadcn/ui
- MapLibre GL JS, Turf.js, and Zod
- A deferred PostgreSQL/Drizzle proposal; no database is used by this POC
- Vitest, Testing Library, and Playwright
- ESLint and Prettier

Exact installed versions are recorded in `package-lock.json`. See [dependencies](docs/dependencies.md) for the role of each package and deferred decisions.

## Local setup

Prerequisites:

- Node.js 24 or a supported active-LTS release compatible with the locked dependency tree
- npm 11+

```bash
npm install
copy .env.example .env.local
npm run dev
```

No database is required. Results exist only in the current browser session and
the downloaded JSON selected by the staff user.

## Environment variables

Copy `.env.example` to `.env.local`. Staff-access, GIS, and optional AI
credentials are server-only. No provider key uses a `NEXT_PUBLIC_` prefix.
`DATABASE_URL` and the deferred rate-limit/storage variables are optional and
unused by the current POC.

See [environment variables](docs/architecture.md#environment-boundary) for the proposed contract.

## Property data inspector

Start the local application:

```bash
npm run dev
```

Open <http://localhost:3000>, enter a supported Auckland property address, and
select **Fetch property data**. The page displays the resolved LINZ address,
mapped parcel identity, dataset availability, evidence-use status, all configured
pool scenarios, calculated size range, deterministic score and confidence,
sourced risks/actions, and the AI or deterministic explanation. Candidate shells
and their indicative construction envelopes are drawn only when verified
geometry produces a tested placement. **Download session assessment** saves a
bounded JSON assessment without raw provider payloads or geometry.

Staff size preferences are limited to Compact, Standard, Large, or no
preference; intermediate shells remain deterministic comparison scenarios. A
front, rear, or side-yard preference requires the staff user to supply the
known cardinal direction of the property's front boundary. The POC never
infers frontage from an address point, parcel shape, or private access leg.

The browser calls `POST /api/internal/data-access`. Provider credentials remain
server-side, requests and provider responses are bounded, and duplicate form
submissions are disabled while an analysis is running. Provider hosts, retries,
timeouts, concurrency, request/response bytes, and returned geometry are bounded.
Safe API errors contain stable codes and correlation IDs, not provider payloads,
credentials, or stack traces.

The result map uses MapLibre to show authenticated LINZ aerial imagery, the
confirmed parcel boundary, and the resolved address point with visible LINZ
attribution. A server-side tile route keeps the LINZ Basemaps key out of browser
requests.

Loopback development (`localhost` or `127.0.0.1` under `next dev`) is available
without staff credentials. Every non-loopback or deployed request fails closed
unless `INTERNAL_ACCESS_USERNAME` and `INTERNAL_ACCESS_PASSWORD` are both set;
the browser then uses HTTP Basic authentication for Royal Glass staff access.

## Quality commands

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

Playwright covers controlled complete journeys for `42A Bahari Drive` and
`2/49 Pigeon Mountain Road`, plus ambiguity, duplicate submission, retry,
imagery failure, AI/fallback, no-clear-candidate, and download behavior:

```bash
npm run test:e2e
```

## Database

The current POC has no database and no durable report history. The optional
future PostgreSQL model is documented in [database.md](docs/database.md), but no
schema or migration is part of this release.

Planned commands:

```bash
npm run db:generate
npm run db:migrate
npm run db:studio
```

## Test property

The application accepts different Auckland property addresses. Controlled tests
cover `42A Bahari Drive, Ranui, Auckland`, distinguish it from `42 Bahari Drive`,
and separately cover `2/49 Pigeon Mountain Road, Half Moon Bay, Auckland`.
Fixtures are test inputs only and never become product defaults.

Run the internal spike with an explicit address:

```bash
npm run spike:data-access -- "42A Bahari Drive, Ranui, Auckland"
npm run spike:verify-aerial -- "42A Bahari Drive, Ranui, Auckland"
npm run smoke:live-layers -- "42A Bahari Drive, Ranui, Auckland"
npm run smoke:live-layers -- "2/49 Pigeon Mountain Road, Half Moon Bay, Auckland"
```

The aerial verifier accepts any supported address, performs the same live
address/parcel resolution, checks point-in-parcel alignment, loads real LINZ
aerial tiles, and saves a local verification screenshot under `output/playwright/`.
It is an internal data-access check, not a pool-feasibility finding.

The live-layer smoke is a separate manual provider check. It prints only safe,
normalized availability and feature-count evidence; automated tests use local
fixtures and do not call live GIS services.

Generic verification screenshots can contain a full residential address and
precise imagery, so they are ignored by Git and should be deleted after the local
check. Only the approved `2359811-aerial-alignment.png` regression artifact is
eligible for retention in this POC repository.

There is deliberately no default property. Standard street addresses and
LINZ-style unit forms are accepted, and ambiguous matches require explicit staff
selection before parcel analysis.

## Deployment

Deployment and audience widening are outside this release. Any later deployment
must retain fail-closed staff access and server-only credentials, and separately
resolve distributed rate limiting, Council generated-report reuse, Watercare
licence restrictions, retention, durable storage, and rollback.

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
- [Release readiness](docs/release-readiness.md)
