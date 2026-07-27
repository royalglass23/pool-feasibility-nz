import type { AddressMatch, DataAccessSpikeGateway, ParcelMatch } from "./data-access-gateway";

export type CustomerParcelStatus = "confirmed" | "unconfirmed" | "not_found";
export interface CustomerAddressConfirmation {
  addressId: string | null;
  fullAddress: string | null;
  parcelId: string | null;
  status: CustomerParcelStatus;
  message: string;
  options?: Array<{ addressId: string; fullAddress: string }>;
}

export async function confirmAddressSelection(
  input: { address: string; selectedAddressId?: string },
  gateway: Pick<DataAccessSpikeGateway, "searchAddresses" | "findParcelsAt">,
): Promise<CustomerAddressConfirmation> {
  const matches = await gateway.searchAddresses(input.address);
  const selected = selectAddress(matches, input.address, input.selectedAddressId);
  if (!selected) return { addressId: null, fullAddress: null, parcelId: null, status: "not_found", message: "We could not find that Auckland address." };
  if (selected.kind === "ambiguous") return { addressId: null, fullAddress: null, parcelId: null, status: "unconfirmed", message: "Choose the exact address before we confirm its legal parcel.", options: selected.options };

  const parcels = await gateway.findParcelsAt(selected.address.coordinates);
  if (parcels.parcels.length !== 1) return { addressId: selected.address.addressId, fullAddress: selected.address.fullAddress, parcelId: null, status: "unconfirmed", message: parcels.parcels.length === 0 ? "We found the address, but its legal parcel needs manual review." : "More than one legal parcel was found. Manual review is required." };
  const parcel = parcels.parcels[0];
  const confirmed = isConfirmedParcel(parcel);
  return { addressId: selected.address.addressId, fullAddress: selected.address.fullAddress, parcelId: parcel.parcelId, status: confirmed ? "confirmed" : "unconfirmed", message: confirmed ? "Address and legal parcel confirmed." : "The address is viewable, but the legal parcel needs manual review." };
}

function selectAddress(matches: AddressMatch[], requestedAddress: string, selectedAddressId?: string): { kind: "selected"; address: AddressMatch } | { kind: "ambiguous"; options: Array<{ addressId: string; fullAddress: string }> } | null {
  if (selectedAddressId) {
    const selected = matches.find((candidate) => candidate.addressId === selectedAddressId);
    return selected ? { kind: "selected", address: selected } : null;
  }
  const exact = matches.filter((candidate) => normalizeAddress(candidate.fullAddress) === normalizeAddress(requestedAddress));
  if (exact.length === 1) return { kind: "selected", address: exact[0] };
  if (matches.length === 1) return { kind: "selected", address: matches[0] };
  return matches.length > 1 ? { kind: "ambiguous", options: matches.map(({ addressId, fullAddress }) => ({ addressId, fullAddress })) } : null;
}

function isConfirmedParcel(parcel: ParcelMatch): boolean {
  return parcel.titles.length === 1 && parcel.parcelIntent === "Fee Simple Title";
}

function normalizeAddress(value: string): string {
  return value.toLocaleLowerCase("en-NZ").replace(/\bnew zealand\b/g, " ").replace(/\b\d{4}\b/g, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+auckland$/, "");
}
