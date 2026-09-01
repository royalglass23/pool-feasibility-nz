/**
 * The address-identity seam used by autocomplete and Property Check selection.
 *
 * It deliberately excludes parcel, aerial, and other property-layer work, so
 * an indexed implementation can replace live LINZ address lookup independently.
 */
export type AddressMatch = {
  addressId: string;
  fullAddress: string;
  fullAddressNumber: string;
  unit: string | null;
  territorialAuthority: string;
  coordinates: [longitude: number, latitude: number];
};

export type AddressSearchStatus = {
  indexedAt: Date | null;
  isFresh: boolean;
};

export interface AddressSearch {
  search(query: string): Promise<AddressMatch[]>;
  getById(addressId: string): Promise<AddressMatch | null>;
  status(): Promise<AddressSearchStatus>;
}

export class AddressIndexUnavailableError extends Error {
  constructor() {
    super("ADDRESS_INDEX_UNAVAILABLE");
    this.name = "AddressIndexUnavailableError";
  }
}
