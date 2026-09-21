# Site Constructability Report Plan

Status: Working draft for the wider constructability journey. The bounded report remediation authorised on 16 September 2026 is limited to preserving terrain audit evidence, keeping unpromoted DEM evidence out of homeowner conclusions, retaining complete report attribution, and conforming the existing three-page report implementation to [the approved report contract](./report-format.md). The provisional 300 mm side-only assumption was approved on 18 September 2026 under RG-337; its application and report presentation remain future RG-342/RG-343 work. The remaining Site questions, route interaction and barrier assessment are separate planned slices.

## Objective

Extend the existing Preliminary report into one consolidated report that retains the current mapped findings and adds:

- excavation and construction access;
- indicative pool-barrier feasibility; and
- ground-condition risk screening.

The report remains preliminary guidance. It is not surveying, engineering advice, legal advice, barrier-compliance confirmation, consent or approval to undertake construction.

The existing report sections are strengthened and renamed as:

- **Terrain and ground conditions**;
- **Pool barrier feasibility**; and
- **Excavation and construction access**.

The existing report structure remains intact. The bounded remediation may change report layout, formatting and copy only as needed to restore the approved three-page contract, preserve complete attribution and maintain the preliminary-report disclaimer. It does not authorise the remaining constructability journey or any concurrent feature expansion.

## Confirmed product decisions

- Users receive one consolidated Preliminary report rather than a separate constructability report.
- The report is saved and shown only after the existing contact-and-consent details step.
- Before entering their details, users complete the same three short Site-question interactions for every property. The journey has a hard maximum of five interactions.
- Every Site question includes an “I’m not sure” response.
- Missing or uncertain evidence remains visibly `Not assessed` or requires onsite confirmation; it is not treated as a clear result or as a property constraint.
- Automatic mapped/API evidence and user-declared Site answers both contribute to the report, with their provenance kept distinct.
- The first version does not request or accept site-photo uploads. The report supports the first conversation between homeowner and pool professional; it does not attempt to replace that conversation with remote site inspection.
- Existing report sharing, lead capture and post-report contact behaviour remain unchanged. Builder matching, referral routing and new communication workflows are outside this feature.
- PoolReady proposes a Suggested access route from the street to the selected pool. The user confirms it, adjusts it or marks it uncertain before the report is generated.
- Confirming, adjusting or marking the Suggested access route uncertain is the first Site question.
- Access/excavation conditions and nearby barrier features are collected through two separate multi-select Site questions rather than several follow-up prompts. Together with route confirmation, the first version has three Site-question interactions and remains below the five-question cap.
- Homeowner questions ask only about directly observable conditions. PoolReady or a pool professional interprets machinery and construction suitability; homeowners are not asked to make that judgement.
- Selecting a condition does not trigger additional questions in the first version. PoolReady records it as a potential consideration in the report for later discussion with a pool professional.
- The best result available to a new constructability section is **“No obvious concern identified — confirm onsite.”** Do not use wording that implies the section is clear, safe, compliant, suitable or professionally verified.
- A critical “I’m not sure” answer or unavailable critical evidence prevents the overall report from saying “Appears suitable” and produces the neutral **Not fully assessed** state.
- A mapped or user-declared Potential site consideration produces **Needs checking**.
- Only when all three Site questions are answered and no mapped or declared concern is identified may the existing overall result remain **Appears suitable**; each new section still says **“No obvious concern identified — confirm onsite.”**
- Constructability evidence uses the conservative merge policy in [ADR-0006](./adr/0006-conservative-constructability-evidence-merge.md): a concern identified by mapped/API evidence or a user answer is retained, neither source may clear a concern from the other, and disagreements are shown in the report.
- Immediately after Pool layout, PoolReady shows an editable **Estimated pool depth**. It defaults to 1.5 m and supports preliminary residential modelling up to 2.0 m. The 2.0 m ceiling is a PoolReady scope limit, not a claim that deeper pools do not exist. Values greater than 1.8 m show **“Specialist depth — professional confirmation required,”** and deeper projects sit outside this estimate.
- Estimated pool depth becomes locked when the user selects the existing **Check for constraints** action so downstream excavation and site-assessment results share one stable depth input.
- Version one adds no new external data-provider integration. It uses the existing parcel, address, aerial, building, DEM/terrain, contour, flood, drainage, planning, stormwater, water/wastewater, electricity and gas evidence. Landslide susceptibility, groundwater bores, NZGD investigations, regional geology and transport/vehicle-crossing datasets are deferred.
- The saved assessment snapshot preserves the Estimated pool depth, all three Site answers, access-route geometry and route provenance (`suggested`, `confirmed`, `user-supplied` or `uncertain`). Report results must be reproducible from that saved evidence rather than recalculated from later user or provider state.
- Failure or unavailability of terrain or another provider does not block the user from completing the journey or accessing the report. The affected result becomes **“Not assessed — data unavailable,”** confidence is reduced, and missing evidence cannot be treated as absence of a concern.
- When terrain data alone is unavailable, PoolReady may still show the provisional pool-outline and 300 mm side-allowance geometry scenarios, labelled **“Base geometry estimate only — terrain adjustment unavailable.”** The section and overall result remain Not fully assessed. The side scenario does not include base depth or terrain cut.
- Royal Glass staff can view the saved depth, route, Site answers, provenance and resulting findings through the existing staff assessment workflow. Staff correction, override and onsite-verification controls are deferred to a later slice.
- The locked Estimated pool depth, the three Site answers, access-route geometry and route provenance are saved in the trusted assessment snapshot used to produce the consolidated report.

## Draft Site questions

1. Show the Suggested access route and ask the user to confirm it, adjust it or select “I’m not sure.”
2. Ask: **“Are there any visible conditions that could affect construction access or excavation?”** Choices are gate or narrow passage; steps or a steep level change; overhead wires, branches, roof or carport; fence, landscaping or structure that may need removal; possible access through another property; retaining wall near the pool; apparently rocky ground; apparently wet or soft ground; `None of these`; and `I’m not sure`.
3. Ask: **“Which existing features are close to the proposed pool area?”** Choices are fences; walls; gates; doors or windows; decks; raised areas; trees or structures; `None of these`; and `I’m not sure`.

Both questions permit multiple selections except that `None of these` and `I’m not sure` are exclusive. Selections do not trigger follow-up questions in version one.

All three Site-question interactions are always shown. Data informs the suggested route, explanations and report findings rather than hiding questions. In particular, aerial imagery cannot reliably prove the absence, dimensions or condition of fences, gates, doors, windows or climbable objects.

If available evidence cannot support a credible Suggested access route, PoolReady does not draw or invent one and does not require the user to create one. The route response is “I’m not sure.” Adjustment is offered only when PoolReady has displayed a credible suggestion.

Suggested access routing follows [ADR-0007](./adr/0007-deterministic-construction-access-route.md). Deterministic spatial evidence owns the proposed route; aerial AI may add possible-obstacle findings but cannot choose, invent or alter the route.

The first version adds no road-edge or vehicle-crossing API. It proposes a route only when the existing parcel, address, aerial, building and terrain evidence supports an obvious corridor; otherwise it records “I’m not sure.” Additional access datasets are deferred until observed outcomes demonstrate that they are needed.

When a user adjusts the Suggested access route, it becomes a **User-supplied access route** labelled **“Route supplied by user — confirm onsite.”** PoolReady may calculate terrain and mapped intersections along it, but must preserve its user-declared provenance.

Route adjustment uses the fixed start and pool-area endpoints plus at most two user-movable turning points. The visible line may update during interaction, but terrain and mapped-intersection analysis runs only after adjustment finishes or the user confirms the route.

### Construction-access calculations

For either a Suggested access route or User-supplied access route, the first version calculates only:

- approximate route length;
- elevation change and steepest mapped gradient;
- whether the route leaves the mapped parcel;
- mapped-building intersections;
- mapped-service intersections or close approaches; and
- possible visible obstacles from aerial imagery.

The first version does not infer machinery fit, minimum usable width, crane requirements or a confirmed construction method.

### Indicative excavation volume

PoolReady may calculate preliminary **geometry scenarios** from the selected pool dimensions and locked Estimated pool depth. The initial side-only scenario uses the temporary, disclosed 300 mm per-side proxy recorded in [RG-337](./excavation-modelling-contract.md). It requires professional confirmation and is not a quantity survey or a maximum excavation quantity.

- The pool-outline scenario is selected length × width × Estimated pool depth.
- The 300 mm side-allowance scenario is `(length + 0.6 m) × (width + 0.6 m) × depth`. It uses the Firth masonry specification's side allowance as a proxy around PoolReady's generic selected outline; Firth's actual reference is the outside masonry wall.
- Report text must state that base depth, wall/footing dimensions, floor profile, drainage, terrain cut and excavation method are not included. It must not call the larger scenario an upper bound.
- A later builder-specific setting and full working/base/terrain model remain [RG-346](https://linear.app/royalglass/issue/RG-346) work. The existing map construction envelope is not treated as a full-depth excavation footprint.

Spare-material expansion, loose spoil quantity, onsite reuse, truckloads, offsite disposal and dollar-cost estimation are outside this feature. They remain discussion topics between the homeowner and pool professional after they review the preliminary excavation volume and site considerations.

### Pool-barrier evidence boundary

[MBIE F9/AS1](https://www.building.govt.nz/building-code-compliance/f-safety-of-users/pool-safety/acceptable-solutions-and-verification-methods) allows fences, walls and parts of buildings to form a residential pool barrier around the immediate pool area. Its 1200 mm dimensions include minimum barrier-height and climbability requirements; they are not a universal horizontal fence offset from the pool. A barrier on a property boundary has separate requirements, including a 1000 mm minimum horizontal distance from the water's edge under F9/AS1.

The existing simple 1.2 m `barrier` envelope in placement geometry is therefore not compliance geometry and must not be labelled or assessed as a compliant barrier layout. Final barrier design, gates, openings, climbability and consent remain professional/council checks.

The first version does not draw or propose a barrier line. It combines mapped proximity evidence with the always-shown barrier-features Site question to identify Potential site considerations. Barrier routing and compliance design remain later professional work.

Use `potential consideration` or `condition that could affect` in homeowner-facing language. Avoid `blocker` because an observed condition does not establish that construction is impossible.

## Provisional decision

- Homeowners and pool builders initially answer the same underlying Site question model. Homeowners receive plain-language choices, while pool builders may provide exact measurements, likely machinery and technical notes.
- This audience-specific presentation is deliberately reversible. The shared assessment fields and status model must not depend on keeping the two presentations different.

## Open decisions

- **Later full-model gate:** obtain pool-builder confirmation of construction-specific working-clearance and base-allowance values under RG-346. The provisional 300 mm side-only geometry scenario is separately authorized under RG-337 and must be disclosed as a proxy.
- The deterministic confidence rules that decide whether PoolReady may display a Suggested access route.
- Detailed report layout and copy, which are intentionally deferred while separate report work is in progress.
