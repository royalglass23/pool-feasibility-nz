# Product contract: pool-feasibility-nz

## Problem Statement

Residential property owners need a fast, understandable first-pass view of whether an Auckland property appears to contain space for a swimming pool and what mapped constraints deserve investigation. Current desktop research is fragmented across address, parcel, aerial, hazard, planning, terrain, and network datasets. A useful report must combine those sources without implying approval, safety, exact services, or certainty that the available datasets cannot support.

The application accepts different Auckland property addresses. `42A Bahari Drive, Ranui, Auckland` is the first proof fixture only; it is not a default, fixed property, or hard-coded production input. Confusing it with 42 Bahari Drive, a parent parcel, or a neighbour invalidates that regression assessment.

## Solution

Create an Auckland-only standalone web application that accepts a property address and optional preferred location/size, verifies the address and legal parcel against official data, loads legally reusable mapped evidence, deterministically tests three indicative pool scenarios, and produces an explainable score, separate confidence, sourced risks, practical actions, real attributed map, and three-page preliminary PDF.

The application operates without AI. Optional AI may only restate validated structured findings under a constrained schema and deterministic fallback.

## User Stories

1. As a property owner, I want to enter one Auckland address so that I can request a preliminary desktop assessment.
2. As a property owner, I want ambiguous matches shown to me so that the system does not silently choose the wrong property.
3. As an owner of a unit, rear lot, or subdivision, I want the exact address and legal parcel distinguished from parent and neighbouring land.
4. As a user outside Auckland, I want a clear unsupported-region result rather than an incomplete report.
5. As a property owner, I want optional preferred location and size choices so that candidate ranking reflects my intent without treating it as fact.
6. As a waiting user, I want named progress stages and duplicate-request prevention so that a long analysis is understandable and safe.
7. As a property owner, I want real aerial imagery and the correct parcel boundary so that the report is grounded in the property.
8. As a property owner, I want known building footprints and mapped constraints displayed only when official evidence is available.
9. As a property owner, I want compact, standard, and large scenarios tested so that I can compare indicative options.
10. As a property owner, I want up to three promising candidate zones per scenario so that I know where to investigate first.
11. As a property owner, I want an honest no-clear-candidate result so that an algorithmic miss is not presented as physical impossibility.
12. As a property owner, I want every candidate linked to mapped/calculated evidence so that no position looks invented.
13. As a property owner, I want a deterministic score out of 100 so that rerunning the same version/evidence produces the same result.
14. As a property owner, I want data confidence separate from physical feasibility so that missing information does not masquerade as a site constraint.
15. As a property owner, I want critical flags to qualify a score when serious mapped conditions affect all apparent options.
16. As a property owner, I want risks with severity, evidence, source, confidence, impact, action, and specialist-review status.
17. As a property owner, I want unknown information explicitly listed so that unavailable data is not mistaken for absence.
18. As a property owner, I want a main recommendation and ordered actions grouped by project phase so that I know what to do next.
19. As a property owner, I want a three-page A4 report so that I can review or share a concise preliminary assessment.
20. As a report reader, I want map attribution, dataset sources, timestamps, assumptions, limitations, and report version on the output.
21. As an operator, I want each score/confidence/flag explained by stored evidence and rule IDs so that a report can be audited.
22. As an operator, I want provider calls timed, bounded, and safely classified so that outages do not produce fabricated certainty.
23. As an operator, I want unclear Watercare access treated as unavailable so that the product does not breach terms or infer pipe positions.
24. As a maintainer, I want provider payloads isolated behind adapters so that data-source changes do not spread through the product.
25. As a maintainer, I want Auckland rules separate from common geometry/scoring/reporting so that another region can be added deliberately later.
26. As a maintainer, I want controlled provider fixtures for tests so that CI never depends on live GIS availability.
27. As a security owner, I want server-only credentials, allow-listed outbound calls, rate limits, response/geometry limits, and redacted logs.
28. As a deployment owner, I want Vercel-compatible database/PDF behavior, rollback notes, monitoring, and reproducible migrations.

## Implementation Decisions

- Use a modular Next.js App Router monolith with thin HTTP/UI delivery adapters.
- Use provider-independent domain evidence and a `RegionProvider` port; concrete LINZ, Auckland Council, and approved network adapters terminate external formats.
- Require provenance and confidence on every finding, including unavailable evidence.
- Use validated WGS84 GeoJSON for storage/rendering and a tested metric transformation/operation path for analysis.
- Use Turf.js for the bounded POC spatial workload; do not add PostGIS without measured justification.
- Use central, versioned, deterministic configurations for scenarios, score weights/bands, confidence, critical flags, risk mapping, and recommendations.
- Treat preferred location/size as ranking preferences, not evidence.
- Keep feasibility score and confidence independent.
- Persist one immutable completed assessment snapshot plus queryable evidence/candidate/risk/action rows transactionally.
- Generate PDF from the saved report model, never by re-querying live GIS.
- Keep all provider/database/storage/rate-limit/AI credentials on the server.
- Implement deterministic narrative as the required path; optional AI cannot introduce facts, geometry, or scores.
- Use explicit safe application error codes and correlation IDs.
- Stop after the Stage 2 spike if exact address/parcel or legally reusable core map data cannot be proven.

## Testing Decisions

- Pure geometry, placement, scoring, confidence, flags, risks, and recommendation rules use deterministic unit tests through public module seams.
- Provider adapters use captured/licence-permitted or controlled contract fixtures covering schema drift, timeout, partial failure, invalid geometry, response limits, and zero-versus-unavailable semantics.
- Repository integration tests use isolated PostgreSQL and prove transactional aggregate/snapshot consistency.
- API contract tests cover success, validation, stable errors, duplicate/idempotent requests, rate limits, and safe error leakage.
- The highest end-to-end seam is a fixture-backed browser journey from address input to report and PDF; live GIS is reserved for the explicit manual Stage 2 validation.
- Accessibility, performance, security, and PDF visual/page-count checks are required before release.
- Exact `42A`/`42` wrong-parcel prevention is a named regression fixture and acceptance check.
- At least one additional supplied-address path must exercise the same resolver and parcel-matching interfaces so that the proof fixture cannot become product configuration.

## Out of Scope

- Any region outside Auckland during the POC.
- Approval, building/resource consent determination, engineering or geotechnical design, title/easement/covenant advice, construction safety, exact services, or approved pool placement.
- Scraping interactive maps, reverse engineering private APIs, or using unclear data rights.
- Inferring unavailable water/wastewater assets or private services.
- AI-created facts, maps, geometry, scores, risks, or recommendations.
- Live provider calls in automated tests.
- PostGIS before a measured need.
- Production deployment, public launch, or production data mutation during the planning phase.

## Risks & Rollout Notes

Address/parcel correctness and official data licensing are release-blocking. The data-access spike precedes final UI design. Watercare uncertainty lowers confidence and adds review/locating actions rather than blocking all other mapped analysis. Provider outages require partial/unavailable semantics. Candidate geometry must be labelled indicative and backed by deterministic calculations. PDF runtime must be proven on Vercel before selection.

Rollout is fixture/local first, then a protected preview deployment with provider quotas and structured telemetry, then a narrowly rate-limited Auckland POC. Rollback disables analysis creation while preserving access to already generated immutable reports. No release is allowed without security, validation, migration, PDF, attribution, and observability evidence.
