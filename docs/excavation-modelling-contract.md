# RG-337 interim excavation guidance contract

Status: **Interim guidance approved; numeric excavation modelling pending builder confirmation.**

On 18 September 2026, the product direction was to use New Zealand Building Code and excavation-safety guidance for now, with a builder-confirmed allowance setting later. This record captures the RG-337 interim boundary and the decisions moved to [RG-346](https://linear.app/royalglass/issue/RG-346) before implementing the indicative excavation-volume range in [RG-342](https://linear.app/royalglass/issue/RG-342). It is not an excavation specification or a quantity survey. No working-clearance or base-allowance number has been builder-approved.

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

**Do not display an excavation-volume range under this interim contract.** The cited B1 material and WorkSafe guidance do not establish the builder-specific working clearance, base allowance and application rule needed for the high estimate. A pool professional must still approve those assumptions before numeric excavation-volume implementation. No staff or homeowner setting receives a placeholder default.

## Existing product boundary

- Inputs are the selected pool length, width and locked Estimated pool depth, all in metres. The initial depth is 1.5 m; PoolReady supports up to 2.0 m and flags values over 1.8 m for specialist confirmation.
- The low estimate starts at `length × width × depth`, in cubic metres of in situ ground. It represents pool geometry only and does not assert an exact excavation quantity.
- The high estimate must account for builder-confirmed working clearance and base allowance, then an indicative terrain-cut adjustment when suitable mapped terrain evidence is available.
- The orange construction envelope and the internal 1.2 m placement `barrier` envelope are not excavation footprints. Neither supplies a clearance value.
- The range excludes loose-spoil expansion, truckloads, onsite reuse, disposal, price and construction-method recommendations.
- Once allowances are approved, if terrain is unavailable, the report may show only the base-geometry range using **approved** allowances, labelled “Base geometry estimate only — terrain adjustment unavailable,” with the affected assessment Not fully assessed. Missing terrain is never treated as a zero measured cut.

## Later builder setting — RG-346

Store approved allowance values, units, application rule, residential-pool scope, specialist exclusions, approving builder, evidence reference and effective date together as one versioned setting. Preserve the applied version in each saved assessment so a later setting change cannot rewrite an earlier report. A staff editing interface is not required to record the first approved version; its access and approval workflow can be designed separately.

The [published NZ pool excavation allowance review](./pool-excavation-allowance-source-review.md) records construction-specific measurements that can inform the builder discussion. Its figures are evidence candidates, not default setting values. The setting remains **future work** and must not be populated from those examples without builder approval of the construction scope, reference dimensions and application rule.

## Builder confirmation required in RG-346

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

## Proposed calculation relationship for confirmation

Let `L`, `W` and `D` be selected length, width and locked depth in metres. `V_low = L × W × D` cubic metres. Let `V_allowanced` be the volume produced by the **builder-confirmed application rule**, using the confirmed clearance and base allowance. Let `V_terrain_cut` be a nonnegative, indicative _additional_ in situ cut derived from mapped terrain over the approved excavation footprint, without counting material already represented in `V_allowanced`. Then the proposed high-side relationship is `V_high = V_allowanced + V_terrain_cut`, with `V_high ≥ V_low`.

The exact definition of `V_allowanced`, the terrain reference surface, the terrain integration rule and rounding remain **unapproved**. RG-342 must not infer them from the diagram envelopes or treat an unavailable terrain adjustment as a measured zero. The saved assessment must preserve the assumption version and terrain-availability state needed to reproduce the shown range.

## Deterministic fixture checklist

Numeric expected outputs cannot be approved until the builder has supplied the values and application rule. RG-346 must record hand-calculated expected cubic-metre results for these fixtures before RG-342 starts:

1. **Flat site:** named `L`, `W`, `D`, confirmed allowances, zero mapped terrain cut, expected low and high.
2. **Sloping site:** the same geometry and allowances with a specified terrain surface or explicit cut input, expected additional in situ cut and high result, including the rule that prevents double counting.
3. **Specialist depth:** a depth in the 1.8–2.0 m band, expected numeric result and warning if approved for that band, or an explicit `standard estimate withheld` outcome if the builder excludes it.

For each fixture, include unit conversions, unrounded intermediate values, final rounding and the exact assumption version. A case with terrain unavailable should separately prove the base-geometry-only label and reduced-confidence state.

## Approval record

- Builder and evidence: **pending**
- Confirmed values, units, application and scope: **pending**
- Reviewed calculation rules and numeric fixtures: **pending**
- Approved assumption version: **pending**
- Interim qualitative guidance: **approved for later Site-question and report integration; not yet implemented**
- RG-346 builder-setting gate: **open, awaiting builder confirmation**
- RG-342 numeric excavation-volume implementation gate: **closed until RG-346 completes**
