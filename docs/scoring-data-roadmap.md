# Scoring data roadmap

## Decision

Adding more map layers will improve screening, but it will not by itself make the
current score a reliable prediction of whether Royal Glass can build a pool. The
highest-value missing dataset is a labelled history of Royal Glass assessments
and real project outcomes.

Use three evidence classes:

1. **Score inputs** — reproducible geometry or rules with sufficiently clear
   meaning, coverage and licensing.
2. **Confidence and action inputs** — useful evidence that is incomplete,
   indicative, historic or requires interpretation.
3. **Verified gates** — paid records, professional review or onsite findings that
   can close an unknown but should not be inferred from a map.

An unavailable layer or a zero-feature response must never earn clearance
points.

## Priority roadmap

| Priority | Evidence | Access | Recommended use |
| --- | --- | --- | --- |
| 0 | Royal Glass project outcomes | Internal operational data | Calibrate and validate the score |
| 1 | Selected-pool geometry and pool-barrier feasibility | Existing geometry plus current rules | Deterministic score input |
| 1 | Vector electricity and gas network | Open ArcGIS services; licence differs by layer | Negative constraint screening; never proof of clearance |
| 1 | Auckland landslide susceptibility | Public council mapping | Negative constraint and geotechnical referral |
| 1 | Current title, instruments and survey plans | Paid LINZ order | Human-reviewed legal gate |
| 1 | beforeUdig owner responses and plans | Free enquiry; owner-specific responses | Utility evidence completeness and action gate |
| 2 | Auckland property file or LIM | Paid council order | Human-reviewed consent, hazard and prior-report gate |
| 2 | Nearby NZGD investigations | Public index; records subject to NZGD terms | Confidence and geotechnical referral only |
| 2 | Groundwater bores and observations | Public council/LAWA services, sparse coverage | Confidence and investigation trigger only |
| 2 | Construction access measurements | Aerial/LiDAR plus staff site capture | Score only after outcome calibration |
| 2 | Retaining-wall presence and influence | Property file plus site/engineering review | Verified gate; not automatic adequacy scoring |

## 0. Build the calibration dataset first

The score should predict a defined outcome, not general optimism. Keep separate
labels for:

- a usable position surviving the site visit;
- a position surviving title, utility and geotechnical review;
- building/resource consent being granted and any material conditions;
- commercial viability after earthworks, access and engineering costs; and
- the pool being installed substantially in the assessed position.

For every assessment, retain the immutable evidence snapshot, source dates,
analysis version, candidate geometry, score/category results and confidence.
Then capture:

- site-visit decision and standard reason codes;
- final pool position, size and barrier layout;
- title/easement, utility, flood, geotechnical, groundwater and retaining-wall
  findings;
- access method, equipment constraints and whether a crane or pump was needed;
- consent required/granted/declined, conditions and redesigns;
- quoted versus actual excavation, engineering and access costs;
- delay, cancellation and abandonment reasons; and
- whether construction was completed.

Include rejected, redesigned, cancelled and lost projects, not only successful
installs. Do not train buildability against sales conversion: price, customer
finance and sales performance are different outcomes.

Validate with a time-based holdout set and publish, at minimum, the false-clear
rate, false-block rate and observed success rate for each score/confidence band.
The primary safety metric is the percentage of high-scoring properties later
blocked by a material constraint. Until enough outcomes exist, present the
result as a **mapped-feasibility index**, not a probability.

## 1. Evidence suitable for deterministic screening

### Pool and barrier geometry

Score the selected candidate, not the best of several unseen alternatives.
Model the pool shell, excavation/construction envelope, equipment area and an
indicative barrier envelope separately. MBIE states that residential pools
capable of holding 400 mm or more of water require a barrier; installing the
barrier normally requires building consent, and compliance depends on detailed
features such as gates and climbable objects. Therefore geometry can identify
an apparently workable barrier area, but it cannot award final compliance.
[MBIE pool-safety guidance](https://www.building.govt.nz/building-code-compliance/f-safety-of-users/pool-safety/guidance-for-pool-owners)

The Auckland Council pool lodgement checklist is a useful rule inventory: it
calls out public drains within 2 m, geotechnical/contamination information,
flood or soil hazards, earthworks and vegetation. Treat these as explicit
screening triggers rather than trying to predict a consent decision.
[Auckland Council pool checklist](https://www.aucklandcouncil.govt.nz/building-and-consents/Documents/ac1032-lodgement-checklist-swimming-spa-pool.pdf)

### Planning, flooding and drainage

Keep the existing parcel, building, contour, zone, overlay, floodplain,
flood-prone-area, overland-flow-path, stormwater, wastewater and water layers.
Planning geometry must be evaluated against the current operative plan text;
the map layer alone cannot decide activity status or consent.
[Operative Auckland Unitary Plan](https://unitaryplan.aucklandcouncil.govt.nz/UPOperative2016.html)

Council confirms that its regional flood information is a starting point, not
site-specific proof, and that absence on a map does not exclude site flooding.
Use intersections as penalties/critical flags; use non-intersection only as
bounded mapped evidence with the source and model vintage shown.
[Auckland Council flood-map explanation](https://ourauckland.aucklandcouncil.govt.nz/news/2026/03/understanding-auckland-s-regional-flood-maps/)

Auckland Council geospatial terms restrict substantial copying or republishing
without prior written permission. Existing council evidence should remain under
the repository's `spike_only` gate until generated-report reuse is approved.
[Auckland Council geospatial terms](https://www.aucklandcouncil.govt.nz/geospatial/Pages/geospatial-terms-conditions.aspx)

### Electricity and gas

Add Vector's electricity feeder geometry and distinguish underground cable
from overhead line. The electricity metadata applies CC BY 4.0, requires
attribution and states that the data is provided as-is; it recommends
beforeUdig.
[Vector electricity metadata](https://www.arcgis.com/sharing/rest/content/items/45a165ecd0aa432484bedf1e9de9cf9d/info/metadata/metadata.xml?format=default&output=html)

Vector's public gas service contains distribution-pipe location, material,
function, status and diameter, but its item page does not provide an explicit
licence. Keep gas `internal_reference` until Vector confirms reuse rights.
[Vector gas item](https://www.arcgis.com/home/item.html?id=f5526454e0724ae3af9abeb314449181)

For both layers, an intersection or close approach may reduce feasibility or
raise a critical flag. No returned feature must not produce a clearance award:
open feeder data does not guarantee private service-cable coverage or exact
location/depth.

### Landslide susceptibility

Add Auckland's shallow and large-scale landslide susceptibility bands. Council
states that these maps show susceptibility, not hazard or risk, omit runout and
regression, and are not intended for property-level assessment. High/very-high
intersection may penalise the terrain category and must trigger professional
review; low susceptibility cannot certify stability.
[Auckland landslide study](https://www.aucklandcouncil.govt.nz/UnitaryPlanDocuments/mir-document-landslide-susceptibility-assessment-25092025.pdf)

## 2. Evidence that should change confidence or trigger action

### Title, easements and consent history

The open LINZ parcel/title linkage is useful for matching, but a current Record
of Title is the source for registered rights and restrictions. LINZ's current
fee table lists electronic title, survey-plan and instrument searches at $8 per
record; these are ordered records rather than an open bulk title-instrument API.
[LINZ fees and record descriptions](https://www.linz.govt.nz/products-services/landonline/landonline-fees-and-charges/survey-and-title-fees)

The app should generate an order checklist from the confirmed title reference,
store review status and record which easement/covenant/consent-notice
instruments were reviewed. Legal effect and exact easement influence require a
property lawyer or surveyor. Unregistered interests cannot be conclusively
fetched. Title evidence should close confidence/actions, not be parsed into an
automatic positive score.

Auckland property files contain full building/resource consent documents,
plans, correspondence and available site reports, while a LIM is a summary that
also includes hazards, zoning and utilities. Current published fees are $77 for
a standard property file and $375 for a standard LIM. These are valuable paid
review packs but are not open API data.
[Property-file ordering](https://www.aucklandcouncil.govt.nz/en/buying-property/order-property-report/order-property-file.html),
[LIM ordering](https://www.aucklandcouncil.govt.nz/en/buying-property/order-property-report/order-lim.html),
[Council explanation of their contents](https://ourauckland.aucklandcouncil.govt.nz/news/2023/10/auckland-council-provides-lim-transparency-for-property-categorisation/)

### Geotechnical evidence

Query the NZ Geotechnical Database investigation index by distance, type and
date. Nearby boreholes, CPTs or test pits can show that relevant evidence may
exist, but NZGD is a shared database for engineers and is not complete. Do not
transfer a nearby soil or groundwater result to the subject pool position or
award positive feasibility points from it.
[NZGD official overview](https://www.gns.cri.nz/data-and-resources/new-zealand-geotechnical-database/)

Regional QMAP geology can provide a broad ground-material context and referral
trigger. Its 1:250,000 scale is regional, not property-specific, and its product
terms must be reviewed before report reuse.
[GNS QMAP overview and access](https://www.gns.cri.nz/data-and-resources/1250-000-geological-map/)

### Groundwater

Auckland Council's queryable bore-reference layer includes bore depth, screen
levels, static water level and observation date. This is sparse, historic point
evidence and groundwater is seasonal, so use it to increase/decrease evidence
coverage and trigger investigation, not to estimate excavation water level at
the pool.
[Auckland Council bore service](https://mapspublic.aucklandcouncil.govt.nz/arcgis3/rest/services/NonCouncil/LAWA/MapServer/1)

The final gate is a site-specific geotechnical/groundwater investigation with
levels related to the proposed excavation and relevant season. MBIE describes
ground investigation as phased work that may start with a desk study and site
walkover but proceed to intrusive investigation where required.
[MBIE ground-investigation guidance](https://www.building.govt.nz/building-code-compliance/b-stability/b1-structure/practice-advisory-17)

### beforeUdig and exact utilities

beforeUdig is a free referral/enquiry service. It identifies participating
asset owners and those owners return plans and/or locating instructions; not all
asset owners participate. Capture the ticket area, dates, every notified owner,
response status, plan issue/expiry, safety instructions, permits/standovers and
human-review result.
[beforeUdig FAQ](https://beforeudig.co.nz/excavators/faq)

The returned plans are not open bulk data and their use/retention terms may be
asset-owner-specific. Vector says its reference maps are approximate, valid for
28 days and require hand digging to confirm location. A complete, current
response set can raise utility evidence confidence, but absence must not add
clearance points. Exact route and depth require a locator and potholing.
[Vector reference-map requirements](https://vector.co.nz/business/help-safety/near-our-network/reference-plans)

## 3. Evidence that remains onsite or professional

### Retaining walls

There is no comprehensive authoritative open Auckland dataset for private
retaining walls or their condition. Aerial/LiDAR feature detection may flag a
possible wall, but the property file, topographic survey and structural/
geotechnical inspection must determine its geometry, condition and zone of
influence. MBIE explicitly treats a pool as a surcharge in its retaining-wall
exemption guidance, reinforcing that wall adequacy cannot be inferred from wall
height alone.
[MBIE retaining-wall guidance](https://www.building.govt.nz/projects-and-consents/planning-a-successful-build/scope-and-design/check-if-you-need-consents/building-work-that-doesnt-need-a-building-consent/technical-requirements-for-exempt-building-work/13-support-structures/13-2-retaining-walls-up-to-1-5-metres-depth-of-ground)

### Construction access

Derive provisional measures from imagery and terrain: narrowest route width,
turning points, vertical change, stairs, overhead-line proximity and distance
from road to excavation. Then require staff to confirm gate width, surface,
height clearance, neighbour access, retaining edges, delivery route and likely
equipment at the site visit. Do not assign precise access points until these
measurements have been correlated with actual access method and cost in the
Royal Glass outcome dataset.

### Final consent and barrier outcome

Current plan/rule and barrier checks can identify likely workstreams only. Final
building/resource consent requirements, barrier compliance, engineering design
and inspection remain council/professional gates. Record their outcomes for
future calibration; do not let AI infer them.

## Recommended scoring change

Do not simply add more category weights. Change the result presentation to:

> **Mapped-feasibility index:** 78/100  
> **Evidence coverage:** 64% — medium confidence  
> **Open gates:** title/easements, beforeUdig, onsite access, geotechnical review

Initially, let new evidence mostly change category status, confidence and
critical flags. Re-weight categories only after Royal Glass outcome data shows
which inputs predict site-verified, consentable and commercially viable pools.
