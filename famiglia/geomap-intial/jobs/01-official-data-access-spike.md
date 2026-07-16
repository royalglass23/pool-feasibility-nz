# 01 — Prove reusable official address and parcel access

## Parent

`famiglia/geomap-intial/contract.md`

## What to build

Create a bounded internal spike that accepts a supplied Auckland address, resolves it, identifies its legal parcel, queries each candidate official source, and outputs normalized proof: address alternatives, coordinates, parcel ID/polygon, source availability, raw feature counts, timings, and safe provider errors. Use `42A Bahari Drive` only as the first wrong-parcel regression fixture. Complete the official metadata/licence register and a real map overlay used only for verification.

## Acceptance criteria

- [x] `42A Bahari Drive` is explicitly distinguished from `42 Bahari Drive`, parent, and neighbouring parcels.
- [x] A different supplied Auckland address or accepted address format uses the same resolver and parcel-matching path without sample IDs or coordinates in application code.
- [x] Address point, parcel polygon, and real aerial align visually and numerically.
- [x] Every dataset has official metadata, endpoint, licence, attribution, CRS, attributes, update status, usability, commercial-use, and permission findings.
- [x] Watercare access/reuse is either proven suitable or reported unavailable; no asset is inferred.
- [x] Output lists successes, unavailability, feature counts, latency, and safe errors.
- [x] Fixtures are retained only when redistribution is permitted.
- [x] A critical address/parcel/map/licence blocker stops later implementation and is documented.
- [x] Typecheck, lint, tests, and build pass; unavailable data and assumptions are summarized.

## Blocked by

Stage 1 plan approval.
