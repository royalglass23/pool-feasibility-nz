# Regional expansion design

## Nationwide address baseline (MT-243)

LINZ NZ Addresses is the primary nationwide address source. Address queries are
normalized for case, punctuation, comma-separated input, postcodes, and the
optional `New Zealand` suffix before being sent to the official service. The
resolver preserves LINZ's stable `address_id`; it does not add Google or another
third-party fallback.

Boundary certainty is explicit: `confirmed`, `provisional`, `multiple`, or
`unavailable`. A provisional or unavailable title/boundary result is not treated
as clear space. The focused fixture matrix is in
`tests/fixtures/linz/nationwide-address-cases.json`; generate the separate
coverage/latency artifact with `npm run coverage:linz`, or use `--live` only with
approved official-provider network access.

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
