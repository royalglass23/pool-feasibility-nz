import type { PropertyTerrainSource } from "@/modules/terrain/property-terrain";
import { aucklandDemTileCatalogue } from "./auckland-dem-tile-catalogue";
import {
  AUCKLAND_DEM_DATASETS,
  matchesAucklandDemRequiredMetadata,
} from "./auckland-dem-source-contract";

export function aucklandDemReportEligibility(
  source: PropertyTerrainSource,
  homeownerReportApproved: boolean,
): "approved" | "not_approved" {
  if (
    !homeownerReportApproved ||
    source.evidenceUse !== "report_allowed" ||
    !matchesControlledDatasetIdentity(source) ||
    !matchesAucklandDemRequiredMetadata(source)
  ) {
    return "not_approved";
  }

  const assets = source.contributingAssets ?? [];
  return assets.length > 0 &&
    assets.every(
      (asset) =>
        matchesControlledDatasetIdentity({
          ...asset,
          datasetDate: AUCKLAND_DEM_DATASETS.find(
            (dataset) => dataset.collectionUrl === asset.stacCollectionUrl,
          )?.datasetDate,
        }) &&
        matchesControlledAsset(asset) &&
        asset.stacCollectionUrl &&
        asset.stacItemUrl &&
        asset.assetChecksum &&
        asset.assetUpdatedAt &&
        asset.retrievedAt,
    )
    ? "approved"
    : "not_approved";
}

function matchesControlledAsset(
  asset: NonNullable<PropertyTerrainSource["contributingAssets"]>[number],
): boolean {
  return aucklandDemTileCatalogue.tiles.some(
    (tile) =>
      tile.collectionUrl === asset.stacCollectionUrl &&
      tile.assetUrl === asset.assetUrl &&
      tile.stacItemUrl === asset.stacItemUrl &&
      tile.assetChecksum === asset.assetChecksum.toLowerCase() &&
      tile.assetUpdatedAt === asset.assetUpdatedAt,
  );
}

function matchesControlledDatasetIdentity(value: {
  provider?: unknown;
  dataset?: unknown;
  datasetIdentifier?: unknown;
  datasetDate?: unknown;
}): boolean {
  return (
    value.provider === "Land Information New Zealand" &&
    AUCKLAND_DEM_DATASETS.some(
      (dataset) =>
        value.dataset === dataset.dataset &&
        value.datasetIdentifier === dataset.datasetIdentifier &&
        value.datasetDate === dataset.datasetDate,
    )
  );
}
