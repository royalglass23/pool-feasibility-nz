# Second-address generalisation evidence

Captured 2026-07-16 after the user clarified that `42A Bahari Drive` is only a
sample address.

## Changes proven

- The internal CLI now requires an explicit address. With no address it returns
  `ADDRESS_REQUIRED`; there is no default property.
- Candidate matching tolerates Auckland-only shorthand and removes a supplied NZ
  postcode/country suffix before deterministic comparison.
- LINZ lookup accepts ordinary street addresses plus slash-unit and `Unit ...`
  forms using the supplied base street number, full road name and unit.
- No application code contains the Bahari address IDs, parcel IDs or coordinates.
  Those values exist only in the licensed regression fixtures and evidence.
- Provider timeouts are returned as `PROVIDER_TIMEOUT`, not Node/DOM exception
  numbers or raw provider details.

## Live second-address proof

Command:

```powershell
npm run spike:data-access -- "2/49 Pigeon Mountain Road, Half Moon Bay, Auckland"
```

The official live run resolved:

- LINZ address ID `2453674`.
- Address point `174.899769829008, -36.8868090715903`.
- Containing primary-parcel record `4789010`, Lot 87 DP 67795.
- Parcel intent `DCDB` with titles `NA33D/17`, `NA33D/18`, and `NA33D/19`.
- Zero provider errors on the successful retry.

This result demonstrates why a different address cannot be treated as a simple
copy of the Bahari fixture. The unit address maps to a containing multi-title
parcel. The spike now returns
`containing_parcel_requires_confirmation` and blocks the later report path from
presenting that polygon as the unit's confirmed legal parcel. A Record of Title
and unit-title boundary review are required.

Raw Council and LINZ feature counts remain provider-query evidence only. They are
not feasibility findings.
