import type { DatasetEvidence } from "@/modules/data-access-spike/data-access-gateway";
import type { AucklandDemRequiredMetadata } from "@/modules/providers/linz/auckland-dem-source-contract";
import type { TerrainGrid } from "@/modules/terrain/assess-pool-area-slope";

const MAX_DEM_TRANSFER_BYTES = 4_000_000;

export type AucklandDemSourceMetadata = AucklandDemRequiredMetadata & {
  stacItemUrl: string;
  assetChecksum: string;
  assetUpdatedAt: string;
  retrievedAt: string;
};

export type NztmBounds = {
  minimumEast: number;
  minimumNorth: number;
  maximumEast: number;
  maximumNorth: number;
};

export type AucklandDemTransferBudget = { remainingBytes: number };

export function createAucklandDemTransferBudget(): AucklandDemTransferBudget {
  return { remainingBytes: MAX_DEM_TRANSFER_BYTES };
}

export type AucklandDemProvenance = Pick<
  DatasetEvidence,
  | "provider"
  | "dataset"
  | "datasetIdentifier"
  | "status"
  | "licenceStatus"
  | "evidenceUse"
  | "retrievedAt"
  | "datasetDate"
  | "licence"
  | "attribution"
  | "geometryUsed"
  | "attributesUsed"
  | "evidenceType"
  | "confidence"
> &
  AucklandDemSourceMetadata & {
    stacCollectionUrl: string;
    assetUrl: string;
  };

export type AucklandDemWindowResult =
  | {
      status: "available";
      grid: TerrainGrid;
      provenance: AucklandDemProvenance;
    }
  | {
      status: "needs_checking";
      reasons: string[];
    };
