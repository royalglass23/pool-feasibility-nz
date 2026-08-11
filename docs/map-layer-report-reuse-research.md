# Map-layer reproduction rights for homeowner PDF reports

**Retrieved:** 11 August 2026  
**Scope:** the Auckland Council and Watercare layers currently queried by GeoMap  
**Status:** licensing research, not legal advice

## Decision summary

| Provider and layer                                                          | Access evidence                                            | Reuse evidence                                                                                                                                                                                      | Homeowner PDF policy                                                                                                    |
| --------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Auckland Council stormwater pipe, manhole/chamber, catchpit and watercourse | Public ArcGIS Feature Services support query and extract   | Each exact item says CC BY 4.0 and identifies Healthy Waters, Auckland Council                                                                                                                      | **Allow** bounded property-level geometry in reports, with attribution, change notice and Council's warnings            |
| Auckland Council Contours 2016, layer 11                                    | Public MapServer supports query, map and data access       | The exact ArcGIS item is not publicly readable and the service exposes copyright but no open licence                                                                                                | **Do not allow yet**; keep `spike_only`, or migrate to the explicitly CC BY 4.0 Contours 2024 Open Data source          |
| Watercare water and wastewater networks                                     | The exact hosted Feature Services are public and queryable | Current Watercare GIS page says CC BY 4.0, but the exact hosted items have blank licence fields and Watercare's live Open Data catalogue still assigns CC BY-NC-ND 3.0 NZ to the named asset layers | **Do not allow yet**; keep `internal_reference` until Watercare reconciles the conflicting terms for the exact services |

Public or anonymous technical access is not, by itself, permission to reproduce
data in a customer report. Report eligibility follows the licence attached to the
exact dataset, plus any provider-specific conditions.

## What CC BY 4.0 permits

The [CC BY 4.0 legal code](https://creativecommons.org/licenses/by/4.0/legalcode)
permits reproduction and sharing of the licensed material, in whole or in part,
and the production and sharing of adapted material in any medium. It does not
contain a non-commercial restriction. When material is shared, the user must
retain supplied creator, copyright, licence, disclaimer and source information,
link the licence where reasonably practicable, and indicate modifications. It
also prohibits implying provider endorsement.

For GeoMap, clipping source geometry to a property area, changing the source
symbology and compositing it over an aerial image should be treated as a
modification. The PDF should say that the data was clipped and rendered for the
report.

## Auckland Council

### Council-wide rules

The Council's [Open Data user licence](https://new.aucklandcouncil.govt.nz/en/geospatial/council-open-data/user-licence-auckland-council-open-data.html)
expressly allows reuse in maps, websites, printed material and published
applications. It says that, unless specifically stated otherwise, Open Data is
licensed under CC BY 4.0. It requires attribution to the original creator and
the licence to remain associated with the data.

The separate [geospatial terms](https://new.aucklandcouncil.govt.nz/en/geospatial/geospatial-terms-conditions.html)
allow personal and business use but prohibit copying or republishing a
"substantial amount" without prior written consent. They also say the information
is illustrative and indicative, must be independently verified before action,
has no accuracy or fitness warranty, and must not be used for legal disputes.

The phrase "substantial amount" is not defined. A clipped property-level extract
is materially different from republishing a regional dataset, but GeoMap should
still prevent bulk export, raw provider payload download and report generation
that could cumulatively operate as a substitute data service.

### Exact stormwater datasets

The exact Council ArcGIS items used by GeoMap are owned by `OpenDataUser` in the
Auckland Council organisation. Each item:

- identifies `Healthy Waters, Auckland Council` as the source;
- permits personal and business use;
- names CC BY 4.0 as its licence;
- repeats the substantial-republication limitation and the indicative,
  independent-verification, no-warranty and no-legal-dispute conditions.

| GeoMap dataset                 | Exact source and licence metadata                                                                                                                                                                                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stormwater Pipe                | [ArcGIS item `cdea334c7ba9498c89b70977569007d7`](https://www.arcgis.com/sharing/rest/content/items/cdea334c7ba9498c89b70977569007d7?f=pjson) and [layer 0](https://services1.arcgis.com/n4yPwebTjJCmXB6W/ArcGIS/rest/services/Stormwater_Pipe/FeatureServer/0?f=pjson)                |
| Stormwater Manhole and Chamber | [ArcGIS item `dab6f385653f4f899715465dcbd6c849`](https://www.arcgis.com/sharing/rest/content/items/dab6f385653f4f899715465dcbd6c849?f=pjson) and [layer 0](https://services1.arcgis.com/n4yPwebTjJCmXB6W/ArcGIS/rest/services/Stormwater_Manhole_And_Chamber/FeatureServer/0?f=pjson) |
| Stormwater Catchpit            | [ArcGIS item `91bc332f958b4b5b97f9e93ee6f9abc1`](https://www.arcgis.com/sharing/rest/content/items/91bc332f958b4b5b97f9e93ee6f9abc1?f=pjson) and [layer 0](https://services1.arcgis.com/n4yPwebTjJCmXB6W/ArcGIS/rest/services/Stormwater_Catchpit/FeatureServer/0?f=pjson)            |
| Stormwater Watercourse         | [ArcGIS item `0ecd434661f74bf980e940cf6f699c99`](https://www.arcgis.com/sharing/rest/content/items/0ecd434661f74bf980e940cf6f699c99?f=pjson) and [layer 0](https://services1.arcgis.com/n4yPwebTjJCmXB6W/ArcGIS/rest/services/Stormwater_Watercourse/FeatureServer/0?f=pjson)         |

**Conclusion:** a static customer PDF is an expressly contemplated map/printed
reuse. These four layers can be classified `report_allowed` for bounded
property-level output. Include the dataset names, Healthy Waters/Auckland
Council attribution, CC BY 4.0 link, retrieval date, modification notice and the
Council warnings. Do not imply that the mapped assets are surveyed locations or
that the Council endorses the report.

### Contours 2016

GeoMap currently queries [Contours 2016, layer 11](https://mapspublic.aucklandcouncil.govt.nz/arcgis/rest/services/Contours/MapServer/11?f=pjson).
The endpoint is public and advertises `Query,Map,Data`; it identifies Auckland
Council as copyright owner. Its service item ID is
`22ef125b7c1d4374822d19bcf2c63d45`, but that item is not publicly accessible
through ArcGIS Online and the service does not expose an item-level open licence.
It therefore cannot be confidently tied to the Open Data licence merely because
it is technically queryable.

Council now publishes [Contours 2024 (NZVD2016)](https://www.arcgis.com/sharing/rest/content/items/e5ad3a918b7e4738aa0332ef63474f8b?f=pjson)
as an Open Data vector-tile item whose metadata expressly applies CC BY 4.0 and
permits business use. This is a clean licensing route, but it is a different
source and vintage, so adopting it requires a technical and accuracy migration,
not just a metadata change.

**Conclusion:** keep the legacy 2016 layer `spike_only` and omit it from customer
reports. Prefer migrating to Contours 2024 and validating its coverage,
resolution, styling, query/extract path and report renderer. If the 2016 layer
must remain, obtain written permission for automated customer-PDF reproduction.

## Watercare

### Current broad licence statement

Watercare's current [GIS Maps page](https://www.watercare.co.nz/builders-and-developers/tools-fees-and-resources/gis-maps)
says that the tools show Auckland water and wastewater networks, requires users
to independently verify the data, and states that the GIS Maps are licensed
under CC BY 4.0. That page links both the Watercare GIS viewer and Watercare Open
Data.

Watercare's [general website terms](https://www.watercare.co.nz/home/about-us/our-organisation/terms-of-use)
otherwise limit material to personal, informational or non-commercial use unless
indicated otherwise, and require permission for commercial reproduction. The GIS
page's CC BY 4.0 statement is a strong, newer and subject-specific indication
otherwise.

### Conflict in the exact dataset evidence

GeoMap queries these official Watercare-organisation items:

- [Wastewater Network item `4575fac1a82149b5b43c3c17862c04eb`](https://www.arcgis.com/sharing/rest/content/items/4575fac1a82149b5b43c3c17862c04eb?f=pjson): pipes layer 5, manholes layer 3 and fittings layer 1.
- [Water Network item `ecf3fbbbb9834a6d9949da89b9d1477c`](https://www.arcgis.com/sharing/rest/content/items/ecf3fbbbb9834a6d9949da89b9d1477c?f=pjson): pipes layer 5 and fittings layer 4.

Both are public, owned by `wsl_admin` in Watercare's ArcGIS organisation, and
support anonymous query. Both have blank `licenseInfo` and `accessInformation`
fields.

The current Watercare viewer linked from the GIS page uses
[web map `f446779c3ede43b9a1890208a4810a69`](https://www.arcgis.com/sharing/rest/content/items/f446779c3ede43b9a1890208a4810a69/data?f=pjson),
which references Watercare-hosted `wslgis.water.co.nz` MapServers rather than the
two hosted Feature Services queried by GeoMap.

More importantly, Watercare's live Open Data catalogue still assigns
**CC BY-NC-ND 3.0 NZ** to the named asset records:

| Asset record       | Current official Open Data metadata                                                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wastewater Pipe    | [item `c6630b1357824f0a8fce0ebde6839f67`](https://data-watercare.opendata.arcgis.com/api/search/v1/collections/dataset/items/c6630b1357824f0a8fce0ebde6839f67) |
| Wastewater Manhole | [item `a17a042243e94731a246767d173ea80a`](https://data-watercare.opendata.arcgis.com/api/search/v1/collections/dataset/items/a17a042243e94731a246767d173ea80a) |
| Wastewater Fitting | [item `98753d02f5a14d84baa2db1016d7e28b`](https://data-watercare.opendata.arcgis.com/api/search/v1/collections/dataset/items/98753d02f5a14d84baa2db1016d7e28b) |
| Water Pipe         | [item `f7815fae85e84fa8ad5afc2158c5bdbe`](https://data-watercare.opendata.arcgis.com/api/search/v1/collections/dataset/items/f7815fae85e84fa8ad5afc2158c5bdbe) |
| Water Fitting      | [item `d0641489bf3c41a08286d27ffff94391`](https://data-watercare.opendata.arcgis.com/api/search/v1/collections/dataset/items/d0641489bf3c41a08286d27ffff94391) |

Those Open Data records point to older Watercare MapServer layers rather than
GeoMap's hosted Feature Services, but the layer names and subject matter match.
The non-commercial restriction conflicts with paid/commercial homeowner reports,
and the no-derivatives restriction conflicts with clipping, restyling and
compositing the geometry. A public endpoint does not resolve that conflict.

**Conclusion:** the current GIS-page statement is credible evidence that
Watercare intends CC BY 4.0 for its GIS maps, but it does not unambiguously
license the exact GeoMap services while their item metadata is blank and the
provider's own asset catalogue still states CC BY-NC-ND 3.0 NZ. Keep all
Watercare layers `internal_reference` and out of customer PDFs until Watercare
confirms that CC BY 4.0 applies to the exact hosted items, or publishes corrected
item-level metadata. Record the confirmation or metadata snapshot in this
repository before changing the gate.

## Recommended code policy

1. Promote only these Auckland Council keys to `report_allowed`:
   `public_stormwater_assets`, `manholes`, `catchpits` and `watercourses`.
2. Keep `contours` as `spike_only` while it points to the 2016 MapServer. Create
   a separately reviewed source entry if migrating to Contours 2024; do not
   silently change vintage or endpoint.
3. Keep `wastewater_assets`, `wastewater_manholes`, `wastewater_fittings`,
   `public_water_assets` and `water_fittings` as `internal_reference` until the
   Watercare conflict is resolved for item IDs
   `4575fac1a82149b5b43c3c17862c04eb` and
   `ecf3fbbbb9834a6d9949da89b9d1477c`.
4. For every report-eligible provider layer, store the exact source item/layer,
   licence version, retrieval date and attribution. Render a legible legend and
   attribution directly below or beside the static map, and repeat full links in
   the report's source section.
5. State that provider geometry was clipped and restyled. Preserve all supplied
   disclaimers, say the information is indicative, require independent onsite
   verification before design or works, and avoid any endorsement implication.
6. Continue excluding raw provider attributes and payloads from customer
   downloads. Limit output to the report property and immediate assessment area;
   do not offer bulk or regional exports.

Suggested Council wording:

> Contains Healthy Waters, Auckland Council Stormwater Pipe, Stormwater Manhole
> and Chamber, Stormwater Catchpit and Stormwater Watercourse data, licensed
> under CC BY 4.0. Retrieved 11 August 2026; clipped and restyled for this report.
> Indicative only; independently verify before relying on it. Not for legal
> disputes.

Suggested Watercare wording, **only after the licence conflict is resolved**:

> Contains Watercare Services Limited water and wastewater network data,
> licensed under CC BY 4.0. Retrieved 11 August 2026; clipped and restyled for
> this report. Independently verify before relying on it or carrying out design,
> construction or other works.
