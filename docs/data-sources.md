# Official data-source register

## Status and decision

This register records the Stage 2 data-access spike performed on 16 July 2026
and the MT-211 mapped-layer verification performed on 17 July 2026 for
`42A Bahari Drive, Ranui, Auckland`. The live scripts are:

```powershell
npm run spike:data-access -- "42A Bahari Drive, Ranui, Auckland"
npm run smoke:live-layers
```

The exact-address, legal-parcel, authenticated real-aerial, and official mapped
layer gates passed. Full report implementation must not start yet because
Auckland Council's generated-report reuse position requires review. Watercare's
official public services are mapped for internal reference only under the
recorded non-commercial/no-derivatives licence; they are not report evidence.

Mapped features and counts below are bounded parcel-envelope query results, not
final parcel intersections or feasibility findings. A zero count does not
establish that a real-world constraint or private asset is absent.

## Licence sources applying to multiple datasets

- LINZ licensing: <https://www.linz.govt.nz/products-services/data/licensing-and-using-data>
- LINZ Basemaps technical documentation:
  <https://basemaps.linz.govt.nz/docs/user-guide/technical-documentation/>
- Auckland Council geospatial terms:
  <https://www.aucklandcouncil.govt.nz/geospatial/Pages/geospatial-terms-conditions.aspx>
- Watercare GIS maps and download terms:
  <https://www.watercare.co.nz/builders-and-developers/tools-fees-and-resources/gis-maps>

## Code-enforced evidence-use gate

Technical availability and report eligibility are separate. The spike labels
each observation `report_allowed`, `spike_only`, `internal_reference`, or
`unavailable`. Auckland
Council layers remain `spike_only` even when their bounded API calls succeed;
they cannot enter `reportEligibleDatasets` until the proposed generated-report
and static-PDF reuse is approved. Watercare layers remain `internal_reference`
and require independent verification before action. A public endpoint is not
treated as a licence.

## Dataset records

### 1. Address resolution — NZ Addresses

- **Provider:** Toitū Te Whenua LINZ
- **Metadata:** <https://data.linz.govt.nz/layer/123113-nz-addresses/>
- **Endpoint:** `LINZ_NZ_Addresses/FeatureServer/0` on LINZ's official ArcGIS
  organisation
- **Licence:** Creative Commons Attribution 4.0 International
- **Attribution:** identify LINZ as source, link licence, and retain applicable
  Crown copyright/source notices
- **Geometry / CRS:** point; source NZGD2000 / EPSG:4167, queried as EPSG:4326
- **Relevant attributes:** `address_id`, `full_address`,
  `full_address_number`, number/suffix, road name/type, suburb, city,
  territorial authority, lifecycle
- **Update status:** national dataset described as updated weekly; metadata
  inspected 2026-07-16
- **Usable:** yes
- **Limitations:** address point is not a legal parcel; unit/rear-lot matching
  still requires explicit parcel containment and ambiguity handling
- **Commercial use:** yes, with attribution
- **Additional permission:** no under the recorded licence
- **Live proof:** two features; `42A` address ID `2359811` and `42` address ID
  `969138` are separate current points

### 2. Legal parcel / parcel polygon — NZ Primary Parcels

- **Provider:** Toitū Te Whenua LINZ
- **Metadata:** <https://data.linz.govt.nz/layer/50772-nz-primary-parcels/>
- **Endpoint:** `LINZ_NZ_Primary_Parcels/FeatureServer/0` on LINZ's official
  ArcGIS organisation; LDS spatial-query services also exist but require a key
- **Licence:** Creative Commons Attribution 4.0 International
- **Attribution:** LINZ source and licence attribution
- **Geometry / CRS:** polygon/multipolygon; source NZGD2000 / EPSG:4167,
  ArcGIS service EPSG:2193, queried as EPSG:4326
- **Relevant attributes:** `id`, `appellation`, `parcel_intent`,
  `land_district`, `titles`, `survey_area`, `calc_area`
- **Update status:** metadata last updated 2026-07-11 when inspected
- **Usable:** yes
- **Limitations:** nominal urban cadastral accuracy is not a site survey; the
  ArcGIS mirror returned duplicate representations of the same parcel and must
  be deduplicated by stable parcel ID
- **Commercial use:** yes, with attribution
- **Additional permission:** no under the recorded licence
- **Live proof:** `42A` -> parcel `8545868`, Lot 1 DP 576345, title 1060427;
  `42` -> parcel `8545869`, Lot 2 DP 576345, title 1060428

### 3. Aerial imagery — LINZ Basemaps Aerial

- **Provider:** Toitū Te Whenua LINZ
- **Metadata:** <https://www.linz.govt.nz/guidance/data-service/linz-basemaps-guide/how-use-linz-basemaps-apis>
- **Endpoint:** `https://basemaps.linz.govt.nz/v1/tiles/aerial/3857/`
  XYZ tile API and related style/copyright APIs
- **Licence:** underlying open datasets are generally CC BY 4.0; attribution is
  read from the authenticated aerial StyleJSON rather than duplicated in UI code
- **Attribution:** visible map and PDF attribution required; preserve the raster
  source notice returned by Basemaps and link it to LINZ's custom aerial
  attribution/copyright page. The live aerial style returned `© CC BY 4.0 LINZ`
  when verified on 2026-07-17.
- **Geometry / CRS:** raster XYZ/WMTS tiles, EPSG:3857
- **Relevant attributes:** tileset/style metadata and source copyright entries
- **Update status:** mosaic is updated as source imagery changes; property capture
  date must be surfaced when available
- **Usable:** yes with a valid API key; use a site-restricted developer key for
  public browser delivery and rotate standard keys used by server-side tools
- **Limitations:** imagery is not a survey and capture date/resolution vary
- **Commercial use:** appears permitted subject to underlying source attribution
- **Additional permission:** no general additional permission identified; API key
  is required
- **Live proof:** authenticated aerial tiles rendered on 2026-07-16 at the test
  property. LINZ address `2359811` was inside parcel `8545868`; comparison address
  `969138` was outside. Tiles loaded at zoom 20 with visible LINZ and imagery-
  contributor attribution. Evidence: `output/playwright/2359811-aerial-alignment.png`.

### 4. Existing building footprints — NZ Building Outlines

- **Provider:** Toitū Te Whenua LINZ
- **Metadata:** <https://data.linz.govt.nz/layer/101290-nz-building-outlines/>
- **Endpoint:** `LINZ_NZ_Building_Outlines/FeatureServer/0` on LINZ's official
  ArcGIS organisation
- **Licence:** Creative Commons Attribution 4.0 International
- **Attribution:** LINZ and licence attribution
- **Geometry / CRS:** polygon/multipolygon; source EPSG:2193, queried as EPSG:4326
- **Relevant attributes:** `building_id`, capture source/start/end dates,
  lifecycle, last modified
- **Update status:** layer publication metadata inspected 2026-07-16; nearby
  outlines report Auckland 2017 aerial capture dates
- **Usable:** yes, with explicit capture vintage and confidence handling
- **Limitations:** one parcel-envelope feature was returned, but stale capture can
  omit later structures; footprint is not proof of current building extent
- **Commercial use:** yes, with attribution
- **Additional permission:** no under the recorded licence
- **Live proof:** raw parcel-envelope count `1`

### 5. Contours / elevation — Contours 2016, 0.25 metre layer

- **Provider:** Auckland Council
- **Metadata / endpoint:**
  <https://mapspublic.aucklandcouncil.govt.nz/arcgis/rest/services/Contours/MapServer>
  (queryable layer 11)
- **Licence:** governed by Auckland Council geospatial terms; no separate open
  redistribution licence was identified
- **Attribution:** Auckland Council, layer name, capture/vintage and terms link
- **Geometry / CRS:** polyline; EPSG:2193 with NZVD2016 vertical reference,
  queryable as EPSG:4326
- **Relevant attributes:** `Elevation`, `Year`, `Type`
- **Update status:** service labelled Contours 2016
- **Usable:** conditional for the bounded spike; blocked for generated commercial
  reports pending reuse confirmation
- **Limitations:** approximate/stale terrain evidence; cannot replace a current
  topographical or geotechnical survey
- **Commercial use:** business use appears allowed, but report redistribution is
  unclear
- **Additional permission:** yes/unclear for generated-report reproduction
- **Live proof:** raw parcel-envelope count `6`

### 6. Planning zone — Unitary Plan Base Zone

- **Provider:** Auckland Council, Plans and Places
- **Metadata / endpoint:**
  `Unitary_Plan_Base_Zone/FeatureServer/0` in the official Council ArcGIS
  organisation
- **Licence:** Auckland Council geospatial terms; no separate open licence found
- **Attribution:** Auckland Council, Plans and Places, dataset name and terms link
- **Geometry / CRS:** polygon; EPSG:2193, queried by EPSG:4326 envelope
- **Relevant attributes:** `ZONE` and the service renderer/zone description
- **Update status:** live service `editingInfo` inspected 2026-07-16; effective
  plan status/version requires a later rules adapter
- **Usable:** technical access yes; generated-report use conditional
- **Limitations:** envelope count can cross zone boundaries; zone interpretation
  requires the operative plan text and cannot itself decide consent
- **Commercial use:** business use appears allowed; redistribution unclear
- **Additional permission:** yes/unclear for generated-report reproduction
- **Live proof:** raw parcel-envelope count `2`

### 7. Planning overlays — Significant Ecological Areas representative spike

- **Provider:** Auckland Council, Plans and Places
- **Metadata / endpoint:**
  `Significant_Ecological_Areas_Overlay/FeatureServer/0` in the official Council
  ArcGIS organisation
- **Licence / attribution:** Auckland Council geospatial terms; attribute Council,
  Plans and Places, and the exact overlay layer
- **Geometry / CRS:** polygon; EPSG:2193
- **Relevant attributes:** `TYPE`, `SUBTYPE`, `SCHEDULE`, `NAME`
- **Update status:** live service inspected 2026-07-16
- **Usable:** conditional; this proves one overlay service only
- **Limitations:** not a complete Unitary Plan overlay inventory; all relevant
  overlay families still require an allow-listed catalogue and legal review
- **Commercial use:** business use appears allowed; redistribution unclear
- **Additional permission:** yes/unclear
- **Live proof:** raw parcel-envelope count `0`; this does not prove that no other
  planning overlay applies

### 8. Flood plains — Flood Plains

- **Provider:** Auckland Council, Healthy Waters
- **Metadata / endpoint:** `Flood_Plains/FeatureServer/0` in the official Council
  ArcGIS organisation
- **Licence / attribution:** Auckland Council geospatial terms; attribute Council,
  Healthy Waters, dataset name and model vintage
- **Geometry / CRS:** polygon; EPSG:2193
- **Relevant attributes:** hazard, year produced, model type, rainfall event,
  climate-change adjustment and development scenario where populated
- **Update status:** live service inspected 2026-07-16; individual model vintage
  must be retained from feature attributes
- **Usable:** technical access yes; generated-report use conditional
- **Limitations:** modelled/indicative information; geometry intersection requires
  the actual polygon, not an envelope count
- **Commercial use:** business use appears allowed; redistribution unclear
- **Additional permission:** yes/unclear
- **Live proof:** raw parcel-envelope count `1`

### 9. Flood-prone areas — Flood Prone Areas

- **Provider:** Auckland Council, Healthy Waters
- **Metadata / endpoint:** `Flood_Prone_Areas/FeatureServer/0`
- **Licence / attribution:** Auckland Council geospatial terms; attribute Council,
  Healthy Waters and dataset name
- **Geometry / CRS:** polygon; EPSG:2193
- **Relevant attributes:** service identifier and hazard/model classification
  fields supplied by the layer
- **Update status:** live service inspected 2026-07-16
- **Usable:** technical access yes; generated-report use conditional
- **Limitations:** modelled evidence, not proof of onsite levels or drainage
- **Commercial use:** business use appears allowed; redistribution unclear
- **Additional permission:** yes/unclear
- **Live proof:** raw parcel-envelope count `0`

### 10. Overland-flow paths — Overland Flow Paths

- **Provider:** Auckland Council, Healthy Waters
- **Metadata / endpoint:** `Overland_Flow_Paths/FeatureServer/0`
- **Licence / attribution:** Auckland Council geospatial terms; attribute Council,
  Healthy Waters and dataset name
- **Geometry / CRS:** line/polygon service geometry; EPSG:2193
- **Relevant attributes:** service ID, flow/path classification and model fields
  where populated
- **Update status:** live service inspected 2026-07-16
- **Usable:** technical access yes; generated-report use conditional
- **Limitations:** modelled flow path; zero returned features does not prove no
  surface-flow risk
- **Commercial use:** business use appears allowed; redistribution unclear
- **Additional permission:** yes/unclear
- **Live proof:** raw parcel-envelope count `0`

### 11. Public stormwater assets — Stormwater Pipe

- **Provider:** Auckland Council, Healthy Waters
- **Metadata / endpoint:** `Stormwater_Pipe/FeatureServer/0`
- **Licence / attribution:** Auckland Council geospatial terms; copyright Healthy
  Waters, Auckland Council
- **Geometry / CRS:** polyline; EPSG:2193
- **Relevant attributes:** stormwater asset ID/type, owner, status and available
  material/diameter/level fields
- **Update status:** live service `editingInfo` inspected 2026-07-16
- **Usable:** technical access yes; generated-report use conditional
- **Limitations:** Council says locations are indicative and cannot be assumed to
  align to cadastral boundaries; private pipes and exact depth/position unknown
- **Commercial use:** business use appears allowed; redistribution unclear
- **Additional permission:** yes/unclear
- **Live proof:** raw parcel-envelope count `1`

### 12. Wastewater assets

- **Provider:** Watercare
- **Metadata:** Watercare GIS maps page linked above
- **Official public endpoints:** `Wastewater_Network/FeatureServer/5` (pipes),
  `/3` (manholes), and `/1` (fittings), owned by Watercare's official ArcGIS
  organisation
- **Licence:** CC BY-NC-ND 3.0 NZ shown by Watercare
- **Attribution:** Watercare Services Limited, CC BY-NC-ND 3.0 NZ
- **Geometry / CRS:** provider line and point geometry requested as WGS84 GeoJSON
- **Relevant attributes:** provider properties are retained only as validated
  internal reference metadata
- **Usable:** internal reference only; not report evidence
- **Limitations:** no inference of public or private wastewater position, depth,
  accuracy, connectivity, or absence; independently verify before action
- **Commercial use:** no under the recorded non-commercial licence
- **Additional permission:** yes
- **Live proof (2026-07-17):** 7 pipes, 2 manholes, and 3 fittings returned for
  the bounded 42A parcel envelope

### 13. Public water assets

- **Provider:** Watercare
- **Official public endpoints:** `Water_Network/FeatureServer/5` (pipes) and
  `/4` (fittings), under the same official Watercare ArcGIS organisation
- **Licence / attribution:** same Watercare source and CC BY-NC-ND 3.0 NZ
  position as wastewater
- **Geometry / CRS:** provider line and point geometry requested as WGS84 GeoJSON
- **Usable:** internal reference only; not report evidence
- **Limitations:** no inference of private services, water-main position, depth,
  accuracy, connectivity, or absence; independently verify before action
- **Commercial use:** no under the recorded non-commercial licence
- **Additional permission:** yes
- **Live proof (2026-07-17):** 6 pipes and 2 fittings returned for the bounded
  42A parcel envelope

### 14. Manholes — Stormwater Manhole and Chamber

- **Provider:** Auckland Council, Healthy Waters
- **Metadata / endpoint:** `Stormwater_Manhole_And_Chamber/FeatureServer/0`
- **Licence / attribution:** Auckland Council geospatial terms; attribute Council
  and Healthy Waters
- **Geometry / CRS:** point; EPSG:2193
- **Relevant attributes:** stormwater asset ID/type, owner, status and chamber
  attributes where available
- **Update status:** live service inspected 2026-07-16
- **Usable:** technical access yes; generated-report use conditional
- **Limitations:** indicative position; wastewater manholes are not represented by
  this Council stormwater layer
- **Commercial use:** business use appears allowed; redistribution unclear
- **Additional permission:** yes/unclear
- **Live proof:** raw parcel-envelope count `0`

### 15. Catchpits — Stormwater Catchpit

- **Provider:** Auckland Council, Healthy Waters
- **Metadata / endpoint:** `Stormwater_Catchpit/FeatureServer/0`
- **Licence / attribution:** Auckland Council geospatial terms; attribute Council
  and Healthy Waters
- **Geometry / CRS:** point; EPSG:2193
- **Relevant attributes:** stormwater asset ID/type, owner and status
- **Update status:** live service inspected 2026-07-16
- **Usable:** technical access yes; generated-report use conditional
- **Limitations:** indicative public-asset position; private drainage unknown
- **Commercial use:** business use appears allowed; redistribution unclear
- **Additional permission:** yes/unclear
- **Live proof:** raw parcel-envelope count `0`

### 16. Culverts

- **Provider:** Auckland Council candidate stormwater catalogue
- **Endpoint:** no dedicated official culvert layer or verified asset-type mapping
  was established by this spike
- **Licence / attribution / CRS / attributes / update:** not applicable until a
  specific official layer and semantic mapping are verified
- **Usable:** no
- **Limitations:** must not infer culverts from nearby pipes, channels or imagery
- **Commercial use:** unclear
- **Additional permission:** unclear
- **Live proof:** unavailable

### 17. Watercourses — Stormwater Watercourse

- **Provider:** Auckland Council, Healthy Waters
- **Metadata / endpoint:** `Stormwater_Watercourse/FeatureServer/0`
- **Licence / attribution:** Auckland Council geospatial terms; attribute Council
  and Healthy Waters
- **Geometry / CRS:** polyline; EPSG:2193
- **Relevant attributes:** asset/feature identifier, type/classification and status
  where supplied
- **Update status:** live service inspected 2026-07-16
- **Usable:** technical access yes; generated-report use conditional
- **Limitations:** stormwater asset representation is not a complete regulatory
  watercourse determination
- **Commercial use:** business use appears allowed; redistribution unclear
- **Additional permission:** yes/unclear
- **Live proof:** raw parcel-envelope count `0`

### 18. Electricity distribution feeder lines

- **Provider:** Vector Limited Open Data
- **Metadata / endpoint:** `distribution_feeder_network_and_zone_substations/FeatureServer/2`
- **Licence / attribution:** CC BY 4.0; attribute Vector Limited and the licence
- **Geometry / CRS:** polyline; NZTM2000 / EPSG:2193, queried as EPSG:4326 GeoJSON
- **Relevant attributes:** provider feeder properties, including overhead or
  underground classification where supplied
- **Update status:** public service inspected 2026-07-22
- **Usable:** yes, as preliminary report evidence with attribution
- **Limitations:** Vector says open data may be incorrect, duplicated,
  incomplete, or misleading and must not be represented as reliable without
  validation; it is not an excavation plan
- **Commercial use:** allowed under CC BY 4.0
- **Additional permission:** no, subject to attribution and Vector open-data terms
- **Live proof:** parcel-envelope count `2` at 42A Bahari Drive

### 19. Gas distribution lines

- **Provider:** Vector Limited Open Data
- **Metadata / endpoint:** `gas_distribution_network1/FeatureServer/1`
- **Licence / attribution:** Vector Open Data portal-wide CC BY 4.0 terms;
  attribute Vector Limited and the licence
- **Geometry / CRS:** polyline; NZTM2000 / EPSG:2193, queried as EPSG:4326 GeoJSON
- **Relevant attributes:** pressure level, function, material, and diameter where
  supplied
- **Update status:** public service metadata dated 2026-03-30 and inspected
  2026-07-22
- **Usable:** yes, as preliminary report evidence with attribution
- **Limitations:** zero returned features means no mapped feature in the query
  envelope, not proof that private or public gas services are absent; not an
  excavation plan
- **Commercial use:** allowed under Vector Open Data portal-wide CC BY 4.0 terms
- **Additional permission:** no, subject to attribution and Vector open-data terms
- **Live proof:** parcel-envelope count `0` at 42A Bahari Drive

Both Vector layers require BeforeUdig plans, provider confirmation where
necessary, and onsite locating before design reliance or excavation.

## Live spike output summary

| Item                          | Verified value                           |
| ----------------------------- | ---------------------------------------- |
| Resolved address              | 42A Bahari Drive, Ranui, Auckland        |
| LINZ address ID               | 2359811                                  |
| Coordinates                   | 174.607906917203, -36.8602038189915      |
| Legal parcel                  | 8545868 — Lot 1 DP 576345                |
| Title                         | 1060427                                  |
| Calculated parcel area        | 246 m²                                   |
| Comparison address            | 42 Bahari Drive, LINZ address 969138     |
| Comparison parcel             | 8545869 — Lot 2 DP 576345, title 1060428 |
| Duplicate parcel rows removed | 3                                        |
| Provider errors               | 0                                        |

The separate MT-211 live layer smoke on `2026-07-17T03:51:43.994Z` returned
mapped official geometry for 1 LINZ building outline; 6 Council contours,
2 planning-zone features, 1 flood plain and 1 stormwater pipe; and the Watercare
internal-reference features listed above. Layers returning zero features remain
valid empty provider results. Culverts remain explicitly unavailable.

## Go/no-go gates

- **Address/parcel:** pass.
- **Real aerial/map:** pass; authenticated tiles loaded, parcel/address alignment
  passed numerically and visually, and required attribution is visible.
- **Auckland Council reuse:** conditional; obtain written confirmation for the
  proposed automated generated-report and static-PDF use.
- **Watercare:** official public geometry is available for internal reference
  only; later confidence and actions must still require Watercare review,
  BeforeUdig plans and onsite utility locating.
- **Address/parcel/map prototype:** unblocked using report-eligible LINZ evidence.
- **Internal session-only POC:** eligible to proceed only when the release gates
  in `docs/release-readiness.md` pass. Council evidence must remain labelled
  `spike_only`, Watercare must remain `internal_reference`, and neither can be
  promoted to report-eligible evidence.
- **External/customer report or deployment:** no-go. Council generated-report
  reuse, Watercare restrictions, access control, rate limiting, retention,
  storage, and deployment operations require separate approval and evidence.
