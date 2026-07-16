# Dependency proposal

## Installed Stage 1 baseline

Exact versions are locked in `package-lock.json`; the major responsibilities are:

| Package group        | Packages                                                                                                                          | Purpose                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Web runtime          | `next`, `react`, `react-dom`                                                                                                      | App Router UI, route handlers, server rendering              |
| Styling/UI           | `tailwindcss`, `shadcn`, `@base-ui/react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `tw-animate-css` | Design system and accessible primitives                      |
| GIS                  | `maplibre-gl`, `@turf/turf`, `@types/geojson`                                                                                     | Interactive map and deterministic GeoJSON operations         |
| Validation           | `zod`, `@t3-oss/env-nextjs`                                                                                                       | Input, provider-response, domain, and environment validation |
| Persistence          | `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `dotenv`                                                                | PostgreSQL access and migrations compatible with Vercel      |
| Server boundaries    | `server-only`, `pino`                                                                                                             | Prevent client imports and emit structured logs              |
| Unit/component tests | `vitest`, `jsdom`, Testing Library packages, Vite React/path plugins                                                              | Deterministic domain and UI tests                            |
| End-to-end tests     | `@playwright/test`                                                                                                                | Fixture-backed browser workflow and PDF endpoint checks      |
| Quality tooling      | `typescript`, `eslint`, `eslint-config-next`, `prettier`, `prettier-plugin-tailwindcss`, `tsx`                                    | Type, lint, formatting, and script execution                 |

## Deferred until the owning spike

| Need                            | Candidate                                                                   | Decision gate                                                                |
| ------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| NZTM2000/WGS84 transformation   | `proj4` or a narrowly scoped equivalent                                     | Confirm actual source CRSs and accuracy tests in Stage 2                     |
| PDF browser runtime             | Playwright plus a Vercel-compatible Chromium build, or an external renderer | Prove cold-start, binary size, three-page fidelity, and licensing in Stage 7 |
| Durable PDF storage             | Vercel Blob or compatible object storage                                    | Decide whether immutable PDFs must persist                                   |
| Distributed rate limiting/cache | Upstash Redis or equivalent                                                 | Confirm deployment topology, cost, and licence caching rules                 |
| Optional narrative AI           | Provider SDK                                                                | Add only after deterministic report completion and constrained-output tests  |

No PostGIS dependency is proposed for the POC. Introduce it only after measured application-side spatial limits or cross-property spatial query requirements emerge.

## Package hygiene

The Job 01 remediation retains the current stable Next `16.2.10` and applies a
lockfile-enforced global PostCSS `8.5.19` override. All PostCSS consumers resolve
to that patched stable version, `npm ls` reports a valid tree, and
`npm audit --omit=dev` reports zero production vulnerabilities. The production
build must remain part of the gate because Next declares an older exact PostCSS
dependency upstream.

The full audit still reports four moderate development-only findings through
stable Drizzle Kit's legacy `@esbuild-kit` loader. The upstream stable Drizzle Kit
release remains `0.31.10`; its beta removes that chain, but adopting a beta would
violate the stable-dependency baseline. The cited esbuild advisory concerns an
exposed development server, which this project does not start through Drizzle
Kit. Treat this as a constrained build-tool residual risk: never expose local
tooling servers, recheck each stable Drizzle Kit release, and remove the exception
when a compatible stable path exists.

Do not run `npm audit fix --force`; npm currently proposes incompatible Next and
Drizzle downgrades.
