# 42A Bahari Drive aerial-alignment evidence

Verified 2026-07-16 using authenticated LINZ Basemaps aerial tiles and the live
LINZ address/parcel resolver.

## Command

```powershell
npm run spike:verify-aerial -- "42A Bahari Drive, Ranui, Auckland"
```

## Deterministic result

- Resolved address: `42A Bahari Drive, Ranui, Auckland`
- LINZ address ID: `2359811`
- Selected parcel: `8545868`, Lot 1 DP 576345, title 1060427
- Selected address point inside selected parcel: `true`
- Comparison address `42 Bahari Drive` (LINZ ID `969138`) inside selected parcel:
  `false`
- Selected and comparison addresses separated: `true`
- Authenticated aerial tiles loaded: `true`
- Map zoom: `20`
- Map centre: `[174.6079058, -36.8602033]`
- Required attribution visible: `true`

## Visual inspection

The retained image shows real aerial imagery, the cyan legal-parcel outline,
the selected `42A` address point inside that outline, and the red `42` comparison
point outside it on the neighbouring parcel. The map also shows a scale,
north/compass control, LINZ CC BY 4.0 attribution, and imagery-contributor
attribution.

Screenshot: `output/playwright/2359811-aerial-alignment.png`

The API key remained in the local process/browser context and was not written to
the screenshot, JSON output, Markdown evidence, or committed source. This image
verifies data alignment only; it is not a pool candidate or feasibility finding.
