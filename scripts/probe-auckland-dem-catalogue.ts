import type { Polygon } from "geojson";
import { aucklandDemTileCatalogue } from "../src/modules/providers/linz/auckland-dem-tile-catalogue";
import { resolveAucklandDemTile } from "../src/modules/providers/linz/resolve-auckland-dem-tile";
import type { AucklandDemProvenance } from "../src/modules/providers/linz/auckland-dem-window-contract";
import type { PropertyTerrainSource } from "../src/modules/terrain/property-terrain";
import { createAucklandPropertyTerrainGateway } from "../src/modules/providers/linz/auckland-property-terrain-gateway";
import { KNOWN_AUCKLAND_DEM_BOUNDARY_PARCEL } from "../src/modules/terrain/known-auckland-dem-boundary-parcel";

const LOCATIONS = [
  { label: "West Auckland", longitude: 174.6079, latitude: -36.8602 },
  { label: "Central Auckland", longitude: 174.763, latitude: -36.848 },
  { label: "East Auckland", longitude: 175.14, latitude: -36.79 },
] as const;

async function main(): Promise<void> {
  if (!process.argv.includes("--live")) {
    console.error(
      "Live Auckland DEM access is opt-in. Re-run with --live to read bounded public COG windows, including a known tile-boundary parcel.",
    );
    process.exitCode = 2;
    return;
  }

  const terrain = createAucklandPropertyTerrainGateway();
  const results = [];
  for (const location of LOCATIONS) {
    const parcel = parcelAround(location.longitude, location.latitude);
    const selected = resolveAucklandDemTile({
      parcelGeometry: parcel,
      catalogue: aucklandDemTileCatalogue,
    });
    if (selected.status !== "resolved") {
      throw new Error(`${location.label} is outside the validated catalogue.`);
    }

    const assessment = await terrain.assessParcel(parcel);
    if (assessment.status !== "measured") {
      throw new Error(`${location.label}: ${assessment.reasons.join(" ")}`);
    }
    const source = assessment.source as AucklandDemProvenance;
    if (
      source.assetUrl !== selected.assetUrl ||
      source.stacItemUrl !== selected.provenance.stacItemUrl ||
      source.assetChecksum !== selected.provenance.assetChecksum ||
      source.assetUpdatedAt !== selected.provenance.assetUpdatedAt
    ) {
      throw new Error(`${location.label} returned mismatched tile provenance.`);
    }

    results.push({
      location: location.label,
      tileId: selected.assetUrl.split("/").at(-1)?.replace(".tiff", ""),
      averageSlopeDegrees: assessment.averageSlopeDegrees,
      upperSlopeDegrees: assessment.upperSlopeDegrees,
      provenance: {
        dataset: source.dataset,
        stacItemUrl: source.stacItemUrl,
        assetUrl: source.assetUrl,
        assetChecksum: source.assetChecksum,
        assetUpdatedAt: source.assetUpdatedAt,
        horizontalCrs: source.horizontalCrs,
        gridResolutionMetres: source.gridResolutionMetres,
        verticalDatum: source.verticalDatum,
        licence: source.licence,
        attribution: source.attribution,
      },
    });
  }

  const boundaryAssessment = await terrain.assessParcel(
    KNOWN_AUCKLAND_DEM_BOUNDARY_PARCEL.geometry,
  );
  if (boundaryAssessment.status !== "measured") {
    throw new Error(
      `${KNOWN_AUCKLAND_DEM_BOUNDARY_PARCEL.address}: ${boundaryAssessment.reasons.join(" ")}`,
    );
  }
  const boundarySource = boundaryAssessment.source as PropertyTerrainSource &
    AucklandDemProvenance;
  if ((boundarySource.contributingAssets?.length ?? 0) < 2) {
    throw new Error(
      `${KNOWN_AUCKLAND_DEM_BOUNDARY_PARCEL.address} did not read every contributing DEM tile.`,
    );
  }
  results.push({
    location: KNOWN_AUCKLAND_DEM_BOUNDARY_PARCEL.address,
    tileId: boundarySource.contributingAssets
      ?.map(({ assetUrl }) => assetUrl.split("/").at(-1)?.replace(".tiff", ""))
      .join(" + "),
    averageSlopeDegrees: boundaryAssessment.averageSlopeDegrees,
    upperSlopeDegrees: boundaryAssessment.upperSlopeDegrees,
    provenance: {
      dataset: boundarySource.dataset,
      stacItemUrl: boundarySource.stacItemUrl,
      assetUrl: boundarySource.assetUrl,
      assetChecksum: boundarySource.assetChecksum,
      assetUpdatedAt: boundarySource.assetUpdatedAt,
      horizontalCrs: boundarySource.horizontalCrs,
      gridResolutionMetres: boundarySource.gridResolutionMetres,
      verticalDatum: boundarySource.verticalDatum,
      licence: boundarySource.licence,
      attribution: boundarySource.attribution,
      contributingAssets: boundarySource.contributingAssets,
    },
  });

  console.log(
    JSON.stringify(
      { catalogue: aucklandDemTileCatalogue.source, results },
      null,
      2,
    ),
  );
}

function parcelAround(longitude: number, latitude: number): Polygon {
  const halfSizeDegrees = 0.00004;
  return {
    type: "Polygon",
    coordinates: [
      [
        [longitude - halfSizeDegrees, latitude - halfSizeDegrees],
        [longitude + halfSizeDegrees, latitude - halfSizeDegrees],
        [longitude + halfSizeDegrees, latitude + halfSizeDegrees],
        [longitude - halfSizeDegrees, latitude + halfSizeDegrees],
        [longitude - halfSizeDegrees, latitude - halfSizeDegrees],
      ],
    ],
  };
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Catalogue probe failed.",
  );
  process.exitCode = 1;
});
