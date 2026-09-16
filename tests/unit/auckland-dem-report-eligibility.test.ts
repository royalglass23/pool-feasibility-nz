import { describe, expect, it, vi } from "vitest";
import type { PropertyTerrainSource } from "@/modules/terrain/property-terrain";

vi.mock("server-only", () => ({}));

import { aucklandDemTileCatalogue } from "@/modules/providers/linz/auckland-dem-tile-catalogue";
import { aucklandDemReportEligibility } from "@/modules/providers/linz/auckland-dem-report-eligibility";
import {
  AUCKLAND_DEM_DATASETS,
  AUCKLAND_DEM_HOMEOWNER_REPORT_APPROVED,
  AUCKLAND_DEM_REQUIRED_METADATA,
} from "@/modules/providers/linz/auckland-dem-source-contract";

describe("Auckland DEM homeowner report eligibility", () => {
  it("allows a controlled, attributed indicative measurement in the preliminary report", () => {
    const dataset = AUCKLAND_DEM_DATASETS[0];
    const tile = aucklandDemTileCatalogue.tiles.find(
      (entry) => entry.collectionUrl === dataset.collectionUrl,
    );
    if (!tile) throw new Error("TEST_AUCKLAND_DEM_TILE_MISSING");

    const source: PropertyTerrainSource = {
      provider: "Land Information New Zealand",
      dataset: dataset.dataset,
      datasetIdentifier: dataset.datasetIdentifier,
      datasetDate: dataset.datasetDate,
      status: "success",
      licenceStatus: "permitted",
      evidenceUse: "report_allowed",
      retrievedAt: "2026-09-17T00:00:00.000Z",
      ...AUCKLAND_DEM_REQUIRED_METADATA,
      geometryUsed: "Bounded 1 m bare-earth elevation grid in NZTM2000",
      attributesUsed: ["elevation_metres"],
      evidenceType: "terrain_elevation_grid",
      confidence: "limited",
      contributingAssets: [
        {
          provider: "Land Information New Zealand",
          dataset: dataset.dataset,
          datasetIdentifier: dataset.datasetIdentifier,
          stacCollectionUrl: dataset.collectionUrl,
          assetUrl: tile.assetUrl,
          stacItemUrl: tile.stacItemUrl,
          assetChecksum: tile.assetChecksum,
          assetUpdatedAt: tile.assetUpdatedAt,
          retrievedAt: "2026-09-17T00:00:00.000Z",
          boundsNztm: {
            minimumEast: 1,
            minimumNorth: 2,
            maximumEast: 3,
            maximumNorth: 4,
          },
        },
      ],
    };

    expect(
      aucklandDemReportEligibility(
        source,
        AUCKLAND_DEM_HOMEOWNER_REPORT_APPROVED,
      ),
    ).toBe("approved");
    expect(
      aucklandDemReportEligibility(
        { ...source, evidenceUse: "spike_only" },
        AUCKLAND_DEM_HOMEOWNER_REPORT_APPROVED,
      ),
    ).toBe("not_approved");
  });
});
