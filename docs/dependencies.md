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
| Public rate limiting | `@upstash/ratelimit`, `@upstash/redis`                                                                                            | Distributed rolling limits for serverless public routes      |
| Server boundaries    | `server-only`, `pino`                                                                                                             | Prevent client imports and emit structured logs              |
| Unit/component tests | `vitest`, `jsdom`, Testing Library packages, Vite React/path plugins                                                              | Deterministic domain and UI tests                            |
| End-to-end tests     | `@playwright/test`                                                                                                                | Fixture-backed browser workflow and PDF endpoint checks      |
| Quality tooling      | `typescript`, `eslint`, `eslint-config-next`, `prettier`, `prettier-plugin-tailwindcss`, `tsx`                                    | Type, lint, formatting, and script execution                 |

## Deferred until the owning spike

| Need                          | Candidate                                                                   | Decision gate                                                                |
| ----------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| NZTM2000/WGS84 transformation | `proj4` or a narrowly scoped equivalent                                     | Confirm actual source CRSs and accuracy tests in Stage 2                     |
| PDF browser runtime           | Playwright plus a Vercel-compatible Chromium build, or an external renderer | Prove cold-start, binary size, three-page fidelity, and licensing in Stage 7 |
| Durable PDF storage           | Vercel Blob or compatible object storage                                    | Decide whether immutable PDFs must persist                                   |
| Distributed provider cache    | Upstash Redis or equivalent                                                 | Confirm deployment topology, cost, and licence caching rules                 |
| Optional narrative AI         | Provider SDK                                                                | Add only after deterministic report completion and constrained-output tests  |

No PostGIS dependency is proposed for the POC. Introduce it only after measured application-side spatial limits or cross-property spatial query requirements emerge.

## Package hygiene

The dependency-remediation baseline uses Next `16.3.4`, MapLibre GL JS `6.8.0`,
and Sharp `0.35.4`. Next resolves PostCSS `8.5.23`; both lockfiles resolve its
Nano ID dependency to patched `3.3.18`. The npm lock resolves
baseline-browser-mapping to `2.11.21`, while the pnpm lock resolves patched
`2.11.4`. `npm audit --omit=dev` and `pnpm audit --prod` report zero production
vulnerabilities. The production build remains part of the gate because Next
declares exact transitive runtime dependencies upstream.

MapLibre GL JS 6 requires an explicit worker URL when bundled by Next.js. The
`predev` and `prebuild` lifecycle hooks copy the installed package's worker and
shared ESM modules into `public/maplibre`, and the client map entry points set
the worker URL before constructing a map. Keep both copied files together and
generated from `node_modules` so they remain version-matched.

The full audit can still report development-only findings through Drizzle Kit,
Vitest, and their transitive tooling. They are absent from the production graph
verified by both production-audit commands above. Treat these as constrained
build-tool residual risk: never expose local tooling servers, recheck stable
tooling releases, and remove each exception when a compatible stable path exists.

Do not run `npm audit fix --force`; npm currently proposes incompatible Next and
Drizzle downgrades.
