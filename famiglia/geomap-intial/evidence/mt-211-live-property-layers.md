# MT-211 live official-property-layer evidence

- Checked: `2026-07-17T03:51:43.994Z`
- Address: `42A Bahari Drive, Ranui, Auckland`
- LINZ address ID: `2359811`
- Legal parcel ID: `8545868`
- Command: `npm run smoke:live-layers`
- Overall result: PASS (all required mapped datasets accessible)

This is the separate manual live-provider smoke. CI and automated integration
tests use controlled provider fixtures.

## Returned bounded geometry

| Provider         | Dataset                        | Result | Evidence use         |
| ---------------- | ------------------------------ | -----: | -------------------- |
| LINZ             | NZ Building Outlines           |      1 | `report_allowed`     |
| Auckland Council | Contours 2016                  |      6 | `spike_only`         |
| Auckland Council | Unitary Plan Base Zone         |      2 | `spike_only`         |
| Auckland Council | Planning overlays              |      0 | `spike_only`         |
| Auckland Council | Flood Plains                   |      1 | `spike_only`         |
| Auckland Council | Flood Prone Areas              |      0 | `spike_only`         |
| Auckland Council | Overland Flow Paths            |      0 | `spike_only`         |
| Auckland Council | Stormwater Pipe                |      1 | `spike_only`         |
| Auckland Council | Stormwater Manhole and Chamber |      0 | `spike_only`         |
| Auckland Council | Stormwater Catchpit            |      0 | `spike_only`         |
| Auckland Council | Stormwater Watercourse         |      0 | `spike_only`         |
| Watercare        | Wastewater Pipes               |      7 | `internal_reference` |
| Watercare        | Water Pipes                    |      6 | `internal_reference` |
| Watercare        | Wastewater Manholes            |      2 | `internal_reference` |
| Watercare        | Water Fittings                 |      2 | `internal_reference` |
| Watercare        | Wastewater Fittings            |      3 | `internal_reference` |

Address resolution returned the exact `42A` address plus its comparison address;
legal-parcel resolution returned parcel `8545868`; authenticated LINZ aerial
style access was available. Culverts remained explicitly unavailable.

## Safety and interpretation

- Provider responses were Zod-validated and normalized to 2D WGS84 GeoJSON.
- ArcGIS mapped-layer queries request bounded provider-generalized geometry and
  still enforce response, feature, ring, part, and vertex limits.
- Zero features means only that the queried official service returned none for
  the bounded envelope. It does not prove real-world absence.
- Watercare geometry comes only from Watercare-owned official public services.
  Its recorded CC BY-NC-ND 3.0 NZ terms restrict it to internal reference here.
- Private pipes, service connections, culverts, missing infrastructure, depth,
  accuracy, and connectivity are never inferred.
