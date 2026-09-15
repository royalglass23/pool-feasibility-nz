import type { Polygon } from "geojson";
import type { DatasetEvidence } from "@/modules/data-access-spike/data-access-gateway";

export type PropertyTerrainSource = DatasetEvidence & {
  contributingAssets?: readonly {
    provider: string;
    dataset: string;
    datasetIdentifier: string;
    stacCollectionUrl: string;
    assetUrl: string;
    stacItemUrl: string;
    assetChecksum: string;
    assetUpdatedAt: string;
    retrievedAt: string;
    boundsNztm: {
      minimumEast: number;
      minimumNorth: number;
      maximumEast: number;
      maximumNorth: number;
    };
  }[];
};

export type PropertyTerrainAssessment =
  | {
      status: "measured";
      averageSlopeDegrees: number;
      upperSlopeDegrees: number;
      estimatedFallMetres: number;
      downhillBearingDegrees: number | null;
      downhillDirection: string | null;
      confidence: "indicative";
      source: PropertyTerrainSource;
    }
  | {
      status: "needs_checking";
      reasons: string[];
    };

export interface PropertyTerrainGateway {
  assessParcel(parcelGeometry: Polygon): Promise<PropertyTerrainAssessment>;
}
