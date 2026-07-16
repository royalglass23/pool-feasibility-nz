# 03 — Add normalized provider evidence and mapped constraints

## Parent

`famiglia/geomap-intial/contract.md`

## What to build

Implement the Auckland region provider and approved official adapters so the tracer loads validated buildings, planning, hazards, terrain, stormwater, and legally available utility evidence. Show available and unavailable layers/provenance without exposing provider formats.

## Acceptance criteria

- [ ] Raw provider payloads terminate at adapters and are Zod/GeoJSON validated.
- [ ] Every finding/unavailable result has complete provenance, dates, licence, evidence type, and confidence.
- [ ] CRS conversion and coordinate/geometry/response limits have numeric and visual tests.
- [ ] Calls use allow-listed endpoints, timeouts, bounded retries/concurrency, safe errors, and latency logs.
- [ ] Map layers and legend distinguish verified constraints from unavailable/unknown data.
- [ ] Zero features is not confused with provider failure or missing coverage.
- [ ] Provider timeout, malformed geometry, response overflow, and partial availability integration tests pass.
- [ ] Typecheck, lint, tests, build, and real-route preview pass.

## Blocked by

Job 02 and the Job 01 licence decisions for each enabled dataset.
