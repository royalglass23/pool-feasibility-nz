# 04 — Generate deterministic candidate pool zones

## Parent

`famiglia/geomap-intial/contract.md`

## What to build

Across compact, standard, and large scenarios, deterministically derive apparent open space from the verified parcel/buildings, test configurable construction envelopes at multiple positions/rotations, evaluate verified constraints, rank results, and display up to three candidate zones or an honest unavailable/no-clear-candidate result.

## Acceptance criteria

- [ ] Scenario shell sizes and screening envelopes are central/versioned configuration.
- [ ] Parcel difference, containment, intersection, distance, affected percentage, rotation, placement, slope, and ranking operations have edge-case tests.
- [ ] No candidate crosses outside the parcel or known building footprint after tolerance handling.
- [ ] Preferred input affects ranking only and cannot invent a candidate.
- [ ] Verified hazards/assets affect candidates; unavailable assets remain unknown.
- [ ] Buffers use `Indicative investigation buffer` unless a verified rule supports stronger wording.
- [ ] Algorithm failure uses the required no-clear-candidate wording and never claims impossibility.
- [ ] Map colors, candidate rank, legend, evidence, attribution, and accessible non-map summary agree.
- [ ] Typecheck, lint, tests, build, and fixture-backed browser proof pass.

## Blocked by

Job 03.
