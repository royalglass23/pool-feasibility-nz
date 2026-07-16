# Scout report: official data-access spike

## Scope

Investigate only the external-data uncertainty for Job 01. No feasibility score,
candidate placement, report UI, persistence, or PDF implementation is included.

## Evidence captured on 2026-07-16

### Exact address and parcel identity

- LINZ NZ Addresses returns two distinct current address points for number 42 on
  Bahari Drive: address `2359811` is `42A`; address `969138` is `42`.
- The point for `42A` is approximately `174.6079069, -36.8602038`; the point for
  `42` is approximately `174.6080155, -36.8602064`.
- LINZ NZ Primary Parcels matches `42A` to parcel `8545868`, `Lot 1 DP 576345`,
  title `1060427`, calculated area about 246 square metres.
- LINZ NZ Primary Parcels matches `42` to parcel `8545869`, `Lot 2 DP 576345`,
  title `1060428`, calculated area about 401 square metres.
- Auckland Council's public address/property query services independently return
  site IDs `11526528` and `11526529` respectively. They are corroborating
  evidence only; LINZ remains the legal-parcel source.
- The LINZ parcel service can return duplicate records for the same parcel ID.
  The adapter must deduplicate by stable parcel ID and must fail closed when more
  than one distinct containing parcel remains.

### Provider and licence findings

- LINZ NZ Addresses, NZ Primary Parcels, and NZ Building Outlines are published
  under Creative Commons Attribution 4.0. Their official ArcGIS mirrors are
  publicly queryable without an LDS API key.
- LINZ Basemaps provides an official aerial style/tile API under LINZ open-data
  terms, but a Basemaps API key is mandatory. No key is configured locally, so
  aerial imagery is `unavailable` in this spike run rather than substituted.
- Auckland Council publishes queryable ArcGIS layers for zoning, selected
  overlays, flood plains, flood-prone areas, overland-flow paths, public
  stormwater assets, and contours. Its geospatial terms allow business use but
  restrict copying/republishing a substantial amount and require independent
  verification. Generated-report reuse is therefore `conditional` pending
  written licence confirmation; the spike may perform bounded property queries.
- Watercare documents interactive viewing and manual downloads under CC
  BY-NC-ND 3.0 NZ. No documented automated endpoint with suitable generated
  commercial-report reuse rights was found. Water and wastewater assets are
  therefore `unavailable`; no positions may be inferred.

### Bounded live query observations

The following raw counts came from a small envelope around the LINZ parcel and
prove technical access only. They are not feasibility findings because final
parcel-clipped geometry and licence approval have not been completed.

| Dataset                      | Raw envelope count |
| ---------------------------- | -----------------: |
| Unitary Plan base zone       |                  2 |
| Flood plains                 |                  1 |
| Flood-prone areas            |                  0 |
| Overland-flow paths          |                  0 |
| Stormwater pipes             |                  1 |
| Stormwater manholes/chambers |                  0 |
| Stormwater catchpits         |                  0 |
| Stormwater channels          |                  0 |
| Stormwater watercourses      |                  0 |
| Precincts                    |                  0 |
| 0.25 metre contours          |                  7 |

The count of zero means only that the queried service returned no feature for
that envelope. It does not prove that the real-world constraint or private asset
is absent.

## Planned spike seam

`runDataAccessSpike` will be the single public use-case function. It receives a
validated address and injected HTTP client, calls only a fixed dataset catalogue,
normalises the small proof result, and records timing/status without exposing
credentials or raw provider errors. Tests will use controlled fixtures; the CLI
runner is the only live-provider entry point.

## Risks and decisions

1. **Core map gate remains blocked locally.** Correct parcel geometry is proven,
   but real aerial imagery cannot be demonstrated until a LINZ Basemaps API key
   is supplied (or a separately licensed official alternative is approved).
2. **Auckland Council report reuse is conditional.** Do not promote Council
   layers from spike evidence into generated commercial reports until reuse and
   attribution have been confirmed in writing.
3. **Building outlines are locally stale.** The nearby LINZ footprints currently
   report 2017 Auckland capture sources, so they require visible vintage and
   confidence handling.
4. **Contour coverage is dated.** The inspected Auckland Council service is
   labelled Contours 2016; any later slope derivation would be approximate and
   cannot replace a topographical survey.
5. **No Watercare inference.** Missing automated access must lower data confidence
   and trigger Watercare/BeforeUdig/onsite locating actions in a later slice.

## Go/no-go result

- Address/parcel gate: **pass** for the exact test address.
- Provenance gate: **pass** for LINZ address/parcel/buildings; **conditional** for
  Auckland Council layers; **fail/unavailable** for Watercare automation.
- Map gate: **blocked in the current environment** by the missing Basemaps key.
- Later full report implementation must not start until the map gate and Auckland
  Council reuse terms have been reviewed.
