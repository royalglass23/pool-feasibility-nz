# Stage-by-stage implementation plan

Each stage is an approval checkpoint and an independently demonstrable vertical slice. Every stage ends with type checking, linting, focused/full tests as applicable, a production build, changed-file summary, assumptions, unavailable-data record, and an honest go/no-go decision.

## Stage 1 — Foundation and reviewed architecture

**Outcome:** standalone Git repository; current framework/tooling baseline; server-only environment contract; architecture, dependency, database, data-spike, risk, report, scoring, regional-expansion, contract, and job-slice artifacts.

**Acceptance:** no external-project dependency; no report behavior; strict TypeScript; lint/test/build baseline green or gaps recorded; user approves architecture and Stage 2 approach.

## Stage 2 — Official data-access spike

**User-visible proof:** an internal script/page emits the exact resolved `42A Bahari Drive` match, coordinates, legal parcel ID/polygon, queried/unavailable sources, feature counts, timings, and safe provider errors.

**Work:** verify official catalogue records, endpoints, licences, attribution, commercial/static-report permissions, CRS, update dates, limits, Watercare access, and actual test-property responses. Capture reusable fixtures only when licensing permits. Visually verify address point, parcel, and aerial alignment.

**Stop gate:** no UI/report implementation if exact address/parcel, reusable aerial/parcel access, or legal provenance is critically blocked. Unclear Watercare access is not fabricated; it becomes unavailable with confidence/action consequences.

## Stage 3 — Address, parcel, and map prototype

**User-visible proof:** enter an Auckland address, select among ambiguous matches, reject outside-Auckland inputs, and view real imagery plus the confirmed parcel with attribution.

**Work:** implement input/progress/error states, wrong-parcel prevention, unit/rear-lot handling, thin routes, normalized address/parcel models, a fixture-backed integration seam, and no-secret map configuration.

## Stage 4 — Provider adapters and normalised domain models

**User-visible proof:** the report context lists available/unavailable official datasets with provenance and displays verified buildings/constraints without provider-format leakage.

**Work:** implement `RegionProvider`, LINZ/Auckland adapters, Zod response validation, safe HTTP client, timeouts/retries/size limits, CRS conversion, provenance, capability manifest, and structured provider telemetry.

## Stage 5 — Pool scenarios and candidate-zone analysis

**User-visible proof:** compact/standard/large scenarios return up to three ranked candidates or an honest no-clear-candidate/insufficient-data result on the real parcel.

**Work:** configurable shells/envelopes, parcel/building difference, rotations/placements, verified constraint intersections/distances/slope, ranking, critical geometry tests, and visual candidate layers. Screening buffers remain explicitly indicative.

## Stage 6 — Score, confidence, risks, recommendations

**User-visible proof:** deterministic 0–100 score, separate confidence, category explanations, critical flags, sourced risks, main recommendation, ordered actions, and missing information.

**Work:** central versioned rules, confidence availability/age model grounded in Stage 2, deterministic narrative fallback, optional-AI boundary contract (provider still optional), and full unit/fixture integration coverage.

## Stage 7 — Persisted three-page report and PDF

**User-visible proof:** saved `/report/[id]`, retrieval API, and exactly three attributed A4 pages downloadable from the PDF endpoint.

**Work:** Drizzle schema/migrations/repository, transactional saved aggregate, immutable report snapshot, print view, Vercel PDF-runtime spike, map capture, durable-storage decision, safe download behavior, and visual/PDF failure tests.

## Stage 8 — Production hardening and acceptance

**User-visible proof:** fixture-backed Playwright journey covers address entry through report/PDF; the system explains every score/confidence/flag and handles provider failures safely.

**Work:** rate limiting, idempotency, caching under licence, SSRF allow-listing, response/geometry limits, security abuse tests, performance budgets, accessibility, structured logs/metrics, retention, Vercel deployment/rollback runbook, full documentation, and acceptance validation.

## Dependency order

Stage 2 blocks all provider-backed work. Stage 3 establishes the highest-value user journey. Stage 4 deepens the provider/data boundary. Stages 5 and 6 consume only normalized evidence. Stage 7 persists a completed deterministic aggregate. Stage 8 proves production readiness. No later stage may treat an earlier failed gate as a warning.

## Main technical risks

| Risk                                          | Consequence                               | Planned control / gate                                                                                        |
| --------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `42A` resolves to the wrong address or parcel | Entire report is invalid                  | Exact-match alternatives, stable IDs, point-in-parcel plus discriminator checks, manual Stage 2 overlay proof |
| Dataset access/reuse rights are unclear       | Cannot automate or reproduce maps in PDFs | Official metadata/licence record required; unclear means unusable/unavailable                                 |
| Water/wastewater data lacks approved access   | False assurance or licence breach         | No automation/inference; lower confidence; explicit review and onsite locating actions                        |
| CRS/coordinate-order mismatch                 | Misaligned candidates and constraints     | CRS registry, adapter conversion, validation, numeric/visual fixtures                                         |
| Public GIS service latency/outage/limits      | Slow or failed reports                    | Timeouts, bounded retries, concurrency limits, licence-aware cache, partial availability semantics            |
| Candidate algorithm creates false precision   | User mistakes screening for design        | Configured envelopes, multiple scenarios, evidence-linked ranking, indicative wording, no impossibility claim |
| Aerial keys leak to browser                   | Credential or quota abuse                 | Server-only default; Stage 2 style/tile delivery decision and allow-listing                                   |
| Vercel function/PDF limits                    | Three-page generation fails               | Deployment spike before renderer selection; saved input; optional durable async artifact path                 |
| Missing title/private-service/access data     | Physical score appears overconfident      | Separate confidence and mandatory missing-information/actions                                                 |
| Geometry/provider payload abuse               | Memory/CPU exhaustion or SSRF             | Fixed provider allow-list, URL construction, response/feature/vertex limits, GeoJSON validation               |
| Scoring rules are opaque or double-count      | Untrustworthy score                       | Central versioned rule IDs, category caps, evidence references, deterministic tests                           |
| npm advisories/toolchain drift                | Security/build instability                | Audit dependency paths, lockfile, no forced breaking fixes, CI quality gate                                   |
| JSONB snapshot and child rows diverge         | Report cannot be explained reliably       | Build once from aggregate, transactional repository contract, consistency integration test                    |

## Approval boundary

Stage 1 approval authorizes Stage 2 research and the small spike script/page only. It does not authorize full report UI, database schema deployment, production credentials/data mutation, external publication, or deployment.
