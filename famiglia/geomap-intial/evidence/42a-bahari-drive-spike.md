# Live data-access evidence: 42A Bahari Drive

Captured 2026-07-16 with `npm run spike:data-access -- "42A Bahari Drive,
Ranui, Auckland"` against the fixed official provider catalogue.

## Identity result

- Exact LINZ address ID: `2359811`
- Address point: `174.607906917203, -36.8602038189915`
- Legal parcel: `8545868`, Lot 1 DP 576345, title `1060427`
- LINZ survey/calculated area: `245 / 246 m²`
- Alternative `42 Bahari Drive`: address `969138`, parcel `8545869`, Lot 2 DP
  576345, title `1060428`
- Exact and comparison parcel IDs are distinct.
- Three duplicate LINZ rows for parcel `8545868` were removed by stable ID.

## Raw parcel-envelope counts

| Dataset                      | Count | Result                                |
| ---------------------------- | ----: | ------------------------------------- |
| NZ Building Outlines         |     1 | success                               |
| 0.25 m contours              |     6 | success, Council reuse conditional    |
| Unitary Plan base zone       |     2 | success, Council reuse conditional    |
| SEA representative overlay   |     0 | success, incomplete overlay inventory |
| Flood plains                 |     1 | success, Council reuse conditional    |
| Flood-prone areas            |     0 | success, Council reuse conditional    |
| Overland-flow paths          |     0 | success, Council reuse conditional    |
| Stormwater pipes             |     1 | success, indicative positions only    |
| Stormwater manholes/chambers |     0 | success, stormwater only              |
| Stormwater catchpits         |     0 | success                               |
| Stormwater watercourses      |     0 | success                               |

No provider errors occurred in the successful live run. The first sandboxed run
could not access the providers; the authorised network run completed in about 13
seconds. The slowest observed query was the contour layer at about 4.6 seconds.

## Unavailable / blocked

- LINZ aerial imagery: no `LINZ_BASEMAPS_API_KEY` configured.
- Wastewater and public water: Watercare automation/reuse rights unverified;
  nothing queried or inferred.
- Culverts: no dedicated official endpoint or verified asset mapping found.
- Static/generated report use of Auckland Council data: permission/reuse review
  required.

Counts above do not substitute for parcel-clipped geometry calculations and do
not establish the absence of a real-world feature.
