import { booleanPointInPolygon, point } from "@turf/turf";
import type { Feature, Polygon } from "geojson";
import type { DataAccessSpikeResult } from "./run-data-access-spike";

export interface AddressParcelAlignment {
  selectedAddressInsideParcel: boolean;
  alternatives: Array<{
    addressId: string;
    fullAddress: string;
    insideSelectedParcel: boolean;
  }>;
  selectedParcelSeparatedFromAlternatives: boolean;
}

export function assessAddressParcelAlignment(
  result: Pick<
    DataAccessSpikeResult,
    "resolvedAddress" | "addressAlternatives" | "parcel"
  >,
): AddressParcelAlignment {
  const selectedParcel: Feature<Polygon> = {
    type: "Feature",
    properties: {},
    geometry: result.parcel.geometry,
  };
  const alternatives = result.addressAlternatives.map((address) => ({
    addressId: address.addressId,
    fullAddress: address.fullAddress,
    insideSelectedParcel: booleanPointInPolygon(
      point(address.coordinates),
      selectedParcel,
    ),
  }));

  return {
    selectedAddressInsideParcel: booleanPointInPolygon(
      point(result.resolvedAddress.coordinates),
      selectedParcel,
    ),
    alternatives,
    selectedParcelSeparatedFromAlternatives: alternatives.every(
      (address) => !address.insideSelectedParcel,
    ),
  };
}
