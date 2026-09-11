# Auckland 2024 LiDAR DEM for property-level slope

**Research date:** 11 September 2026
**Decision:** Use the two LINZ-hosted Auckland 2024 **1 m DEM** collections as
the terrain source for an indicative slope proof of concept. Read bounded
property windows from their public Cloud-Optimized GeoTIFFs (COGs); do not use
the DSM, raw point cloud, or derived contours as the primary slope input.

## Answer

There is no single Auckland 2024 DEM layer. The exact bare-earth source is
split into:

| Survey                                                        | Official LINZ layer                                                                                                            | Capture period          | Public COG/STAC collection                                                                                                               |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Part 1, central Auckland / North Island Weather Event capture | [Auckland Part 1 LiDAR 1m DEM (2024), layer 121990](https://data.linz.govt.nz/layer/121990-auckland-part-1-lidar-1m-dem-2024/) | 30 April–27 June 2024   | [Part 1 STAC collection](https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-1_2024/dem_1m/2193/collection.json) |
| Part 2, Auckland's outlying areas                             | [Auckland Part 2 LiDAR 1m DEM (2024), layer 122580](https://data.linz.govt.nz/layer/122580-auckland-part-2-lidar-1m-dem-2024/) | 26 June–4 November 2024 | [Part 2 STAC collection](https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-2_2024/dem_1m/2193/collection.json) |

Both LINZ layer records identify the product as a one-metre raster grid in
NZTM2000 (EPSG:2193), with heights in NZVD2016. Both allow GeoTIFF and ASCII
Grid download and are licensed under CC BY 4.0. The public S3 editions are
LERC-compressed COGs described by static STAC metadata. LINZ's official
[elevation repository](https://github.com/linz/elevation) and
[S3 usage guide](https://github.com/linz/elevation/blob/master/docs/usage.md)
confirm that the bucket is public and can be accessed by HTTPS, GDAL
`/vsicurl/`, or unsigned S3 access.

The COG route was live-verified on the research date: an HTTP byte-range request
to a Part 1 TIFF returned `206 Partial Content` with `Accept-Ranges: bytes`.
It therefore supports bounded reads without downloading the whole tile and
does not require an AWS account or a LINZ API key.

## What each product means

| Product                   | Meaning                                                                                                       | Suitability for GeoMap slope                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Raw LiDAR point cloud** | Classified LAS/LAZ laser returns, including ground and non-ground classes.                                    | Source material with unnecessary volume and processing complexity for a property check.                     |
| **DEM**                   | A raster representation of bare ground with buildings, vegetation, towers, and other surface objects removed. | **Preferred input.** It provides a continuous elevation surface from which slope and aspect can be derived. |
| **DSM**                   | A raster of the highest surface, including roofs, trees, and other objects.                                   | Wrong primary input for ground slope because structures and vegetation create false gradients.              |
| **Contours 2024**         | Equal-elevation vector lines derived from a DEM.                                                              | Useful display evidence, but less complete than the DEM for local slope calculation.                        |

These definitions are from LINZ's official
[elevation data overview](https://github.com/linz/elevation#data-overview).
Auckland Council's separate
[Contours 2024 download](https://www.arcgis.com/home/item.html?id=9401986d33634cbb90daf8459810da96)
states that the contours were derived from a 2024 aerial-LiDAR DEM. That
97.9 GB File Geodatabase is not the DEM and is not needed for this slope route.

## Resolution, reference systems, and accuracy

The published specifications for both parts are:

- horizontal grid spacing: **1 m**;
- horizontal coordinate system: **NZGD2000 / NZTM2000 (EPSG:2193)**;
- vertical datum: **NZVD2016**, using NZGeoid2016 in the survey processing;
- minimum emitted pulse density: **8 pulses/m²**;
- vertical accuracy specification: **±0.2 m at 95% confidence**;
- horizontal accuracy specification: **±1.0 m at 95% confidence**; and
- ground classification: ICSM Level 2.

The contractor reports provide stronger clear-ground validation evidence than
the procurement limits alone:

- [Part 1 survey report](https://data.linz.govt.nz/document/25697-auckland-lidar-survey-report-2024/): approximately 2,100 surveyed test points in 46 groups produced an elevation RMS of 0.035 m, reported as 0.069 m at 95% confidence; expected horizontal accuracy was 0.38 m at 95% confidence.
- [Part 2 survey report](https://data.linz.govt.nz/document/25756-auckland-part-2-lidar-survey-report-2024/): approximately 2,000 surveyed test points in about 51 groups produced an overall post-shift elevation RMS of 0.031 m, reported as 0.061 m at 95% confidence; expected horizontal accuracy was 0.38 m at 95% confidence.

Those validation figures apply to sampled **clear ground** across each survey,
not to every cell. Both reports warn that ground definition may be less
accurate under trees or in isolated terrain/vegetation combinations. A 1 m
cell size is spatial resolution, not a claim of 1 m positional or elevation
accuracy. Cell-to-cell differentiation can also amplify small elevation errors,
so GeoMap should smooth or fit a local surface rather than presenting a raw
single-cell maximum as authoritative.

## Geographic coverage

Part 1 covers the central Auckland capture. Part 2 extends the survey through
the outer mainland and island blocks identified in its survey report: Great
Barrier and Little Barrier, southeast Auckland mainland, Waiheke and Ponui,
Motutapu and surrounding islands, Kaipara, and Rodney.

The STAC collection bounding boxes are:

- Part 1: `174.3677505, -37.3346925, 175.0281809, -36.5514359`;
- Part 2: `174.1503643, -37.3298549, 175.5940431, -36.0228458`.

These rectangles are discovery extents, not proof that every point inside them
has valid ground data. Property processing must use the real published capture
geometry and COG item footprints:

- [Part 1 capture area](https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-1_2024/dem_1m/2193/capture-area.geojson)
- [Part 2 capture area](https://nz-elevation.s3-ap-southeast-2.amazonaws.com/auckland/auckland-part-2_2024/dem_1m/2193/capture-area.geojson)

The union is intended to cover central and outlying Auckland, but GeoMap should
not claim region-wide coverage for an individual address until its analysis
area passes this point-in-coverage test and returns enough non-NoData pixels.

## Recommended automated property extraction route

Use the public COG/STAC distribution as a bounded server-side data source:

1. On a controlled refresh, fetch both collection JSON files, each
   `capture-area.geojson`, and the linked STAC item metadata. Build a small
   spatial index containing item footprints, COG URLs, checksums, capture dates,
   and processing timestamps.
2. For a request, transform the parcel, proposed pool footprint, and a modest
   analysis buffer from WGS84 to EPSG:2193.
3. Check the analysis polygon against the actual capture-area geometry. If it
   is outside coverage, straddles an uncovered gap, or lacks enough valid cells,
   return `Needs Checking`.
4. Select only the intersecting STAC item or items and read the relevant pixel
   window through HTTPS range requests. GDAL `/vsicurl/`, Rasterio, or another
   COG-aware reader can do this without downloading a whole survey or whole
   tile.
5. Mosaic at tile boundaries, reject NoData, clip to the buffered pool area,
   and derive the local elevation gradient in metre-based NZTM coordinates.
6. Return average slope, a robust upper percentile rather than a noisy raw
   maximum, estimated fall across the footprint, and downhill aspect/direction.
   Keep the original source/checksum and quality flags in the assessment
   evidence.
7. Show the result as an **indicative desktop estimate**. A current topographic
   survey remains required for design, excavation, retaining, consent, or
   construction decisions.

This design adds a small on-demand range read from LINZ's public S3-hosted data
unless GeoMap mirrors the bounded tiles. It does **not** add a raw-LiDAR download
or a per-property bulk LINZ export. Cache only bounded derived results and source
metadata under a documented refresh/version policy.

### Why not the other interfaces?

- Each layer's machine-readable service record—[Part 1 services](https://data.linz.govt.nz/services/api/v1.x/layers/121990/services/) and [Part 2 services](https://data.linz.govt.nz/services/api/v1.x/layers/122580/services/)—advertises a Raster Query API of the form `raster.json?key=...&layer=...&x=...&y=...`. It requires an LDS API key and returns a point value. A live check at an Auckland coordinate returned an elevation successfully, but generating a dense property surface this way would require many network calls.
- LDS WMTS/XYZ output is appropriate for display, not for defensible access to the source float grid used in analysis.
- Interactive LDS crop/export is useful for manual or asynchronous downloads, not the normal latency-sensitive property journey.
- The [New Zealand LiDAR 1m DEM, layer 121859](https://data.linz.govt.nz/layer/121859-new-zealand-lidar-1m-dem/) is a convenient current national mosaic and also has a public [national STAC collection](https://nz-elevation.s3-ap-southeast-2.amazonaws.com/new-zealand/new-zealand/dem_1m/2193/collection.json). However, it amalgamates surveys captured from 2008–2025. The two Auckland-specific collections make the 2024 provenance and quality evidence clearer for this Auckland-first product.

## Licence and attribution

Both DEM layer records and their STAC collections state **Creative Commons
Attribution 4.0 International (CC BY 4.0)**. This permits commercial reuse and
adaptation subject to attribution and the licence conditions.

LINZ explains that it does not own every elevation dataset and requires the
licensor to be named in the full attribution. Its current
[elevation attribution register](https://www.linz.govt.nz/products-services/data/licensing-and-using-data/attributing-elevation-or-aerial-imagery-data)
lists **Regional Software Holdings Limited** as licensor for both Auckland 2024
DEM parts. The full form should be:

> Sourced from the LINZ Data Service and licensed by Regional Software Holdings
> Limited, for re-use under the Creative Commons Attribution 4.0 International
> licence.

LINZ also permits the shorter web form `Sourced from LINZ. CC BY 4.0`, linked to
the attribution page. GeoMap should retain the dataset titles, survey part,
capture year, retrieval/processing date, STAC item URL/checksum, licence link,
and notice that the data has been clipped and used to derive slope.

## Data-quality and lifecycle gates

- Part 1's LINZ record says Auckland Council is still refining the dataset and
  that it will be updated when improvements are complete.
- Both datasets have been reprocessed or republished since their initial 2025
  release; their STAC collections were updated on 27 March 2026. Pin and record
  asset checksums instead of assuming an unchanged 2024 product.
- Test representative Part 1, Part 2 mainland, island, tile-edge, vegetation,
  retaining-wall, flat, and steep sites before using the result in homeowner
  reports or scoring.
- Treat missing coverage, excessive NoData, inconsistent neighbouring cells,
  an unavailable source, or an unresolved vertical datum as `Needs Checking`.
- Validate the method against trusted surveyed spot levels before setting slope
  bands or any score threshold. Dataset accuracy does not by itself validate
  GeoMap's slope algorithm.

## Go / no-go

**GO** for a bounded technical proof of concept using public Auckland Part 1 and
Part 2 COG windows. **NO-GO** for presenting the result as survey-grade or using
it for construction, consent, excavation, or retaining decisions. Promotion to
customer reports or feasibility scoring needs calculation fixtures, real-site
comparison, latency evidence, provenance retention, coverage failure handling,
and homeowner wording review.
