# RG-337 provisional excavation allowance contract

Status: **300 mm side allowance approved as a provisional PoolReady assumption; builder-specific settings remain future work.**

On 18 September 2026, the product decision changed: use the published [Firth masonry-pool specification](https://www.firth.co.nz/assets/Uploads/Resources/Documents/FIR0744-Masonry-Swimming-Pools.pdf) as the source of a temporary **300 mm side allowance**, disclose it in the Preliminary report, and add builder-specific settings later under [RG-346](https://linear.app/royalglass/issue/RG-346). The number is a PoolReady modelling assumption, not a Building Code requirement, a builder-approved value, an excavation instruction or a quantity survey. [RG-342](https://linear.app/royalglass/issue/RG-342) may implement the bounded provisional calculation after the depth input in [RG-340](https://linear.app/royalglass/issue/RG-340) is ready.

## Interim guidance contract

The first stage may identify **potential site considerations** from existing mapped evidence and user answers. It must attribute the observation, identify unavailable evidence, and say that excavation method and structural stability require onsite professional assessment. It must not classify a proposed excavation as safe, compliant or suitable.

| Source                                                                                                                                                        | Appropriate use in PoolReady                                                                                                                                    | Boundary                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [MBIE Building Code clause B1 — Structure](https://www.building.govt.nz/building-code-compliance/b-stability/b1-structure)                                    | Explain why the stability of sitework and effects on nearby structures need design-stage consideration.                                                         | B1 sets performance requirements; this preliminary screen does not establish compliance or supply a universal pool-excavation clearance.                                            |
| [WorkSafe excavation-safety good-practice guidance](https://www.worksafe.govt.nz/topic-and-industry/excavation/excavation-safety-gpg/)                        | Flag mapped or declared slope, wet or uncertain ground, retaining or nearby structures, known services, and access uncertainty for competent onsite assessment. | The guidance calls for site-specific risk controls, service locating and competent design of temporary works. It is not a numeric allowance or an excavation-method selection rule. |
| [MBIE Building Code clause F9 — Restricting access to residential pools](https://www.building.govt.nz/building-code-compliance/f-safety-of-users/pool-safety) | Keep pool-barrier questions and findings in their separate evidence section.                                                                                    | Barrier requirements and dimensions do not determine an excavation footprint or working clearance.                                                                                  |

### Check for the requested measures (18 September 2026)

- [B1/AS1, second edition](https://www.building.govt.nz/assets/Uploads/building-code-compliance/b-stability/b1-structure/asvm/b1-structure-as1-second-edition.pdf) does not state a standard residential-pool working clearance or extra excavation depth below the selected pool depth. It is a structural compliance pathway, not a pool excavation quantity formula.
- [WorkSafe excavation-safety guidance](https://www.worksafe.govt.nz/topic-and-industry/excavation/excavation-safety-gpg/) discusses safe access, excavation support, site conditions and distances when working near services. Its service approach distances must not be repurposed as clearance around a pool; its benching and battering controls depend on ground and excavation conditions.
- [Auckland Council's pool-foundation inspection guide](https://www.aucklandcouncil.govt.nz/building-and-consents/Documents/ac1824-guide-to-booking-inspections.pdf) describes checking the excavation against the approved consent and ground conditions before concrete or pool insertion, with engineer inspection where the design requires it. It does not establish a general numeric allowance.

This is a check of these named sources, not a claim that every referenced standard, consent condition or proprietary pool installation specification has been reviewed. A later builder-approved setting may incorporate a documented pool-type-specific specification.

WorkSafe notes that its excavation guide has not been updated to reflect the current Health and Safety at Work Act 2015 and regulations. Use it as practical safety guidance, not as proof of current legal compliance.

Where mapped evidence or a user answer identifies a concern, the interim result is **Needs checking** with the source shown. Where critical evidence is unavailable or the answer is uncertain, use **Not fully assessed** and the affected **Not assessed — data unavailable** explanation as appropriate. No mapped concern means at most **No obvious concern identified — confirm onsite**. These are screening labels, not Building Code compliance findings.

**The provisional figure is 300 mm on each side only.** Firth measures it outward from the **outside masonry wall** for backfill and drainage. PoolReady's selected outline is a generic pool-shell footprint rather than a confirmed Firth outside-wall drawing; applying 300 mm around that outline is an explicitly disclosed product proxy. It must not be described as a measured excavation footprint, a universal clearance, or the maximum possible dig. Do not apply Firth's 100 + 25 + 125 mm floor layers as an extra 250 mm beneath the selected depth: the selected depth's reference level, wall/footing geometry and floor falls do not establish that conversion.

The Preliminary report may show two **illustrative geometry scenarios** using the locked selected dimensions and depth: the pool-outline volume and the same rectangular outline with 300 mm added to each side. It must label the second figure **“300 mm side-allowance scenario”**, not a definitive upper excavation quantity. State that base excavation, wall/footing thickness, floor profile, drainage, terrain cut, battering/support, services and actual installation method are not included. The selected pool/installer's dig sheet and site-specific professional assessment govern the actual excavation. If the report presentation only supports a low-to-high range, it must still explain that the higher figure is a bounded side-only scenario and **not an upper bound**.

Suggested report disclosure: **“Illustrative excavation geometry: [pool-outline value] m³ for the selected pool outline; [side-scenario value] m³ with 300 mm added on each side. The 300 mm assumption is adapted from Firth's masonry-pool guidance, which measures from the outside wall. PoolReady applies it to your selected pool outline as a temporary estimate. These are not minimum and maximum excavation quantities. Base depth, pool walls and footings, drainage, ground slope and construction method are not included. Your pool builder must confirm the actual excavation from the chosen pool's plans and site conditions.”** Use the saved numeric values and assumption version in every report representation.

## Existing product boundary

- Inputs are the selected pool length, width and locked Estimated pool depth, all in metres. The initial depth is 1.5 m; PoolReady supports up to 2.0 m and flags values over 1.8 m for specialist confirmation.
- The pool-outline scenario starts at `length × width × depth`, in cubic metres of in situ ground. It represents pool geometry only and does not assert an exact excavation quantity.
- The provisional side-only scenario is `(L + 0.6) × (W + 0.6) × D` cubic metres, where `L` and `W` are the selected PoolReady outline in metres, `D` is locked Estimated pool depth, and `0.6 m` represents `0.3 m` on each of two opposing sides. The additional width and length are a proxy around the selected outline, not an assertion that it is a Firth masonry wall.
- No extra base depth or terrain-cut amount is assumed. Missing base or terrain evidence is labelled **not modelled**, never measured as zero. RG-342 must decide how to present terrain evidence without turning this scenario into a purported full excavation quantity.
- The orange construction envelope and the internal 1.2 m placement `barrier` envelope are not excavation footprints. Neither supplies a clearance value.
- The scenarios exclude loose-spoil expansion, truckloads, onsite reuse, disposal, price and construction-method recommendations.
- If terrain is unavailable, the report may still show the two side-only scenarios with **“Base geometry estimate only — terrain adjustment unavailable”** and the affected assessment **Not fully assessed**. Missing terrain is never treated as a measured zero cut.

### Hand calculation for RG-342

For a selected `6.0 m × 3.0 m` outline and locked `1.5 m` depth, pool-outline volume is `6.0 × 3.0 × 1.5 = 27.00 m³`. The 300 mm side-allowance scenario is `(6.0 + 0.6) × (3.0 + 0.6) × 1.5 = 35.64 m³`. The difference is `8.64 m³`. These figures exclude extra base depth and terrain cut; `35.64 m³` is **not** a maximum or a construction quantity. RG-342 must test this fixture and show the assumption beside the figure.

## Later builder setting — RG-346

Store later builder-approved allowance values, units, application rule, residential-pool scope, specialist exclusions, approving builder, evidence reference and effective date together as one versioned setting. Preserve the applied assumption version in each saved assessment, including this provisional `firth-masonry-side-300mm-v1` assumption, so a later setting change cannot rewrite an earlier report. A staff editing interface is not required for the provisional assumption; the later access and approval workflow can be designed separately.

The [published NZ pool excavation allowance review](./pool-excavation-allowance-source-review.md) records the source and its construction-specific limits. The builder setting remains **future work**; a later value must replace the provisional proxy only for its approved construction scope, reference dimensions and application rule.

## Builder confirmation required for later RG-346 settings

Record the builder's name, company, role, date and confirmation medium or linked evidence with these answers. Do not mark this contract approved from an unattributed number or a generic published rate.

| Decision                  | Builder answer required                                                                                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Working clearance         | Value and unit; whether measured from each pool edge, along selected edges, or by another rule; whether it extends through the full excavation depth.                                                        |
| Base allowance            | Value and unit; whether added below the selected depth across the same footprint or applied by another rule.                                                                                                 |
| Application               | Uniform allowance or documented rule by pool construction type, geometry, depth, or site condition; exact rule and its inputs.                                                                               |
| Residential scope         | Pool types and depth range for which the standard model is credible. Confirm whether the 1.8–2.0 m specialist-depth band can receive a numeric range with a warning or needs the standard estimate withheld. |
| Specialist exclusions     | Cases needing bespoke builder, geotechnical or engineering assessment, including any excavation method, ground, slope, retaining or groundwater conditions that invalidate the standard model.               |
| Terrain cut               | Whether the proposed terrain adjustment below matches the builder's understanding of the high-side in situ cut and how double counting with clearance/base allowances is avoided.                            |
| Rounding and presentation | Appropriate reporting precision for an indicative cubic-metre range.                                                                                                                                         |

## Later full-calculation relationship for builder confirmation

Let `L`, `W` and `D` be selected length, width and locked depth in metres. `V_low = L × W × D` cubic metres. Let `V_allowanced` be the volume produced by the **builder-confirmed application rule**, using the confirmed clearance and base allowance. Let `V_terrain_cut` be a nonnegative, indicative _additional_ in situ cut derived from mapped terrain over the approved excavation footprint, without counting material already represented in `V_allowanced`. Then the proposed high-side relationship is `V_high = V_allowanced + V_terrain_cut`, with `V_high ≥ V_low`.

The exact definition of `V_allowanced`, the terrain reference surface, the terrain integration rule and rounding for a later **full** excavation-volume range remain **unapproved**. RG-342's provisional side-only scenario must not silently implement this full relationship, infer values from the diagram envelopes, or treat unavailable terrain as a measured zero. The saved assessment must preserve the provisional assumption version and terrain-availability state needed to reproduce what was shown.

## Deterministic fixture checklist

The provisional hand calculation above is approved as a **side-only scenario fixture**. RG-346 must later record builder-approved expected cubic-metre results for a full model using these fixtures:

1. **Flat site:** named `L`, `W`, `D`, confirmed allowances, zero mapped terrain cut, expected low and high.
2. **Sloping site:** the same geometry and allowances with a specified terrain surface or explicit cut input, expected additional in situ cut and high result, including the rule that prevents double counting.
3. **Specialist depth:** a depth in the 1.8–2.0 m band, expected numeric result and warning if approved for that band, or an explicit `standard estimate withheld` outcome if the builder excludes it.

For each fixture, include unit conversions, unrounded intermediate values, final rounding and the exact assumption version. A case with terrain unavailable should separately prove the base-geometry-only label and reduced-confidence state.

## Approval record

- Provisional side allowance: **300 mm per side**, adopted by product decision on 18 September 2026 from Firth's masonry-pool example; **not builder-approved**
- Provisional assumption version: **`firth-masonry-side-300mm-v1`**; implementation and saved-snapshot use remain pending RG-342
- Provisional side-only fixture: **27.00 m³ outline; 35.64 m³ side scenario** for `6.0 × 3.0 × 1.5 m`
- Interim qualitative guidance: **approved for later Site-question and report integration; not yet implemented**
- Builder and evidence for later settings: **pending under RG-346**
- Full working/base/terrain calculation and numeric fixtures: **pending under RG-346 and a later implementation slice**
