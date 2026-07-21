import addressesFixture from "./linz/42-bahari-addresses.json";
import parcelsFixture from "./linz/42-bahari-parcels.json";
import type {
  AddressMatch,
  DataAccessSpikeGateway,
  ParcelQueryResult,
} from "@/modules/data-access-spike/data-access-gateway";
import {
  normalizeAddressResponse,
  normalizeParcelResponse,
} from "@/modules/providers/official-gis-gateway";
import { officialDatasetEvidence } from "@/modules/providers/official-dataset-catalog";

type RawFeatureCollection = {
  features: Array<{
    geometry: { coordinates: unknown };
    properties: Record<string, unknown>;
  }>;
};

export function addressMatchesFrom(
  fixture: RawFeatureCollection,
): AddressMatch[] {
  return normalizeAddressResponse(fixture);
}

export function parcelQueryFrom(
  fixture: RawFeatureCollection,
): ParcelQueryResult {
  return normalizeParcelResponse(fixture);
}

export function createDataAccessGateway(
  overrides: Partial<DataAccessSpikeGateway> = {},
): DataAccessSpikeGateway {
  return {
    datasetEvidence: officialDatasetEvidence,
    searchAddresses: async () => addressMatchesFrom(addressesFixture),
    findParcelsAt: async ([longitude]) =>
      parcelQueryFrom(
        longitude < 174.608 ? parcelsFixture["42A"] : parcelsFixture["42"],
      ),
    countFeatures: async (dataset) => ({
      count: dataset === "planning_zone" ? 2 : 0,
      durationMs: 12,
    }),
    checkAerial: async () => ({
      durationMs: 10,
      attribution: {
        text: "© CC BY 4.0 LINZ",
        url: "https://www.linz.govt.nz/data/linz-data/linz-basemaps/data-attribution",
      },
    }),
    ...overrides,
  };
}
