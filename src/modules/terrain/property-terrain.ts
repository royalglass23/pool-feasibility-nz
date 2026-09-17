import type { Polygon } from "geojson";
import type { DatasetEvidence } from "@/modules/data-access-spike/data-access-gateway";

export type TerrainSlopeSample = {
  position: [longitude: number, latitude: number];
  slopeDegrees: number;
  eastGradient: number;
  northGradient: number;
};

export type PropertyTerrainSource = DatasetEvidence & {
  licenceUrl?: string;
  contributingAssets?: readonly {
    provider: string;
    dataset: string;
    datasetIdentifier: string;
    datasetDate?: string | null;
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
      slopeSamples?: TerrainSlopeSample[];
      selectedPool?: {
        averageSlopeDegrees: number;
        estimatedFallMetres: number;
        sampleCount: number;
      } | null;
      source: PropertyTerrainSource;
    }
  | {
      status: "needs_checking";
      reasons: string[];
    };

export interface PropertyTerrainGateway {
  assessParcel(
    parcelGeometry: Polygon,
    analysisGeometry?: Polygon,
  ): Promise<PropertyTerrainAssessment>;
}
