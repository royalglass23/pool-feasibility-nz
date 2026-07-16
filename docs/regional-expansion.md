# Regional expansion design

National expansion is an architectural seam, not POC scope.

```ts
interface RegionProvider {
  resolveAddress(input: AddressQuery): Promise<AddressMatch[]>;
  getParcel(match: AddressMatch): Promise<ParcelResult>;
  getAerialConfiguration(parcel: ParcelResult): Promise<AerialConfiguration>;
  getBuildingFootprints(parcel: ParcelResult): Promise<DatasetEvidence>;
  getPlanningConstraints(parcel: ParcelResult): Promise<DatasetEvidence[]>;
  getFloodConstraints(parcel: ParcelResult): Promise<DatasetEvidence[]>;
  getTerrain(parcel: ParcelResult): Promise<DatasetEvidence>;
  getStormwaterAssets(parcel: ParcelResult): Promise<DatasetEvidence[]>;
  getUtilityAssets(parcel: ParcelResult): Promise<DatasetEvidence[]>;
}
```

Provider-independent domain types, common spatial analysis, scoring, recommendations, and reporting remain national. Regional planning/environmental rules live in region packages; council and network payloads live behind adapters. National Building Code/pool guidance is versioned independently from regional rules.

Adding a region later requires a provider capability manifest, authoritative dataset register, licence/attribution review, address/parcel fixture set, rule configuration, and the same confidence behavior for unavailable data. Auckland-specific dataset names and ArcGIS/LINZ fields must never leak into common geometry or scoring functions.
