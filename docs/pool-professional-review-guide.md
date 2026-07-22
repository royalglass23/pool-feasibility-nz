# Pool Feasibility Tool - Professional Feedback Guide

## Why you are reviewing this

This is an early screening tool for residential swimming-pool opportunities in Auckland. It uses an address, mapped property information, aerial imagery, and basic repeatable checks to produce a preliminary desktop view.

We are asking a pool professional to test whether the result is useful, understandable, and safe to use in a customer conversation in the future.

## What this tool is and is not

It is:

- an early desktop screening aid;
- a way to highlight possible pool locations and possible constraints;
- a starting point for deciding what should be investigated next.

It is not:

- a consent decision, survey, engineering or geotechnical assessment;
- a title, easement, covenant, or legal review;
- a utility-location service or BeforeUdig replacement;
- a final pool design, construction quote, or guarantee;
- proof that a pool can or cannot be built.

Every result should currently be treated as a preliminary desktop indication only.

## How to access the live tool

Open the production site in a desktop browser:

**Production site:** `[insert Vercel production URL]`

Use the Royal Glass staff login supplied separately:

**Username:** `[insert production username]`  
**Password:** `[insert production password]`

Keep the login private. Do not place it in screenshots, emails, feedback documents, or public messages.

## How to enter the property address

The address field is strict. Enter one complete property address on one line using this pattern:

`unit number/street number and suffix, street name and type, suburb, Auckland`

Examples:

- `42A Bahari Drive, Ranui, Auckland`
- `2/49 Pigeon Mountain Road, Half Moon Bay, Auckland`

For the best result:

- include the unit number for a unit, apartment, or rear dwelling;
- enter the exact street number and suffix, such as `42A`, not just `42`;
- include the street type, such as Road, Drive, Street, or Avenue;
- include the suburb and Auckland;
- enter one property at a time;
- do not enter a client name, legal description, parcel number, map coordinates, or suburb-only search.

If several addresses appear, select the exact full address. Do not choose a similar address because it looks close.

## Basic walkthrough

### 1. Fetch the property

Enter the complete address and select **Fetch property data**. Wait for the property information to load.

### 2. Confirm it is the right property

Before reading the recommendation, check the full address, map location, parcel boundary, address point, aerial image, and unit or suffix. If the wrong property is shown, stop and search again.

### 3. Review the map

Use the map to look at the apparent house position, parcel shape, access, nearby mapped features, and possible pool areas. The map is not a survey. Fences, retaining walls, decks, sheds, services, levels, and drainage may be missing or out of date.

### 4. Review the pool scenarios

The tool tests several standard pool sizes and orientations. It checks whether a pool shape and its working/construction allowance appear to fit inside the mapped parcel without overlapping mapped buildings or some mapped constraints.

Look at the pool size, possible position, ranking reason, constraint notes, and missing-information notes. The tool does not test every possible design or position. “No clear candidate area” means the tested examples did not pass the current desktop checks; it does not prove the property is impossible.

### 5. Read the recommendation

The result contains two separate ideas:

- **Feasibility score:** how favourable the known mapped information appears for the tested scenarios.
- **Data confidence:** how complete and dependable the information is.

A high score with low confidence means the visible information looks promising but important information is missing. A lower score with high confidence means the mapped information gives a more reliable warning about constraints. Treat the result as a starting point, not a promise to the customer.

### 6. Read risks and actions

The risks and actions show what needs to be checked next, such as services, drainage, flooding, access, levels, title matters, or approvals. Download the assessment data before closing the browser if you want to keep a copy. The current tool does not maintain permanent assessment history.

## Reading the result in plain language

| What you see | What it means | How to use it |
|---|---|---|
| Strong preliminary candidate | The tested information looks favourable. | Complete the normal site investigation before giving customer advice. |
| Likely feasible with normal investigations | The site looks promising but still needs normal professional checks. | Continue with site, title, service, planning, and design checks. |
| Potentially feasible but constrained | A pool may be possible, but known constraints need a response. | Work through the constraints before setting expectations. |
| Significant constraints | The mapped information shows material difficulties. | Discuss alternative sizes or positions and consider specialist advice. |
| Low preliminary feasibility | The tested options look difficult with the known information. | Do not treat this as an automatic no; check whether better evidence or another design changes the outcome. |
| Indeterminate | There is not enough reliable information to classify the property. | Resolve the missing property or evidence information first. |
| No clear candidate area | None of the tested examples passed the current checks. | Review the map, consider another design, and arrange proper site checks. |

## What the tool may not know

The current tool may not know about easements, covenants, private services, exact service depths, recent extensions, decks, sheds, retaining walls, actual ground levels, rock, groundwater, soil conditions, access width, crane access, spoil removal, neighbour access, pool barriers, approvals, or the customer's preferred pool and budget.

An empty map layer does not prove that a service or constraint is absent.

## Information needed for a more accurate feasibility report

### Property and legal

- confirmed legal parcel and title information;
- easements, covenants, consent notices, and shared access;
- confirmation that the address, title, and intended work area match.

### Site and survey

- current site survey or reliable measurements;
- house, garage, shed, deck, retaining wall, fence, and driveway locations;
- spot levels, contours, falls, retaining structures, and site photos;
- confirmation of desktop information through a site visit.

### Services and drainage

- BeforeUdig plans where appropriate;
- service-provider confirmation and onsite locating;
- private drainage and inspection-point locations;
- stormwater, wastewater, groundwater, overflow, and dewatering considerations.

### Ground and construction

- geotechnical information for slope, fill, retaining, groundwater, rock, or movement;
- excavation, spoil-removal, machinery, crane, pump, and concrete-truck access;
- neighbour, road, crossing, shared-access, and temporary-works requirements;
- protection of existing buildings and boundaries.

### Planning, consent, and safety

- current planning rules and overlays;
- building/resource consent requirements;
- pool barrier and safety requirements;
- stormwater, overland-flow, works-over, and authority requirements;
- final review by the appropriate qualified professionals.

### Customer and design

- desired size, depth, shape, orientation, views, landscaping, fencing, heating, cover, and plant requirements;
- budget, timing, access expectations, and tolerance for retaining, excavation, service relocation, or design changes.

## Improvements needed before client-facing use

Please identify which of these would make the greatest difference in daily pool work:

- add current survey and level information;
- improve building, structure, drainage, and private-service coverage;
- show the age and confidence of each important dataset;
- make missing, restricted, and reference-only information obvious;
- confirm setbacks, working clearances, access assumptions, and construction allowances with pool professionals;
- test narrow sites, slopes, difficult access, plunge pools, and common pool shapes;
- include practical construction constraints, not just whether a shape fits on a map;
- validate scores against completed projects and known outcomes;
- allow site photos, survey files, title documents, and service plans;
- let a professional record verified items, unknowns, corrections, and notes;
- provide a dated, auditable assessment version;
- keep the main limitations beside the recommendation;
- require professional review before a report is sent externally;
- show report date, evidence dates, assumptions, outstanding actions, and proper disclaimers;
- protect property information and control report access.

## Simple error guide

| Message | Meaning | What to do |
|---|---|---|
| Complete address required | The address is incomplete. | Re-enter one full address using the format above. |
| Address not found | No exact match was found. | Check the number, suffix, street spelling, suburb, and Auckland. |
| More than one address matched | Several properties may match. | Select the exact full address from the choices. |
| Parcel could not be confirmed | The legal property boundary is not certain enough. | Stop and verify the parcel/title manually. |
| Auckland addresses only | The current version does not support that location. | Do not use the result outside Auckland. |
| Official data temporarily unavailable | A mapped information source did not respond. | Try again later and treat that information as unknown. |
| No clear candidate area | The tested pool examples did not fit the mapped information. | Review the map, consider another design, and arrange site checks. |
| Map or aerial image unavailable | The map background or imagery did not load. | Refresh or try again; do not read this as a site problem. |
| Report could not be downloaded | The assessment is available but the file could not be created. | Save the assessment data and use browser print/save if needed. |
| Login or access problem | The production site rejected the login. | Check the supplied details and contact the Royal Glass project owner. |

## Suggested professional review

Test at least two property types if possible: one straightforward property and one with a slope, narrow access, visible services, retaining, flooding, or another complication.

For each test, record:

- whether the address and parcel were correct;
- whether the map looked recognisable and useful;
- whether the suggested pool locations looked realistic;
- what the tool identified correctly;
- what important site factor was missing or misleading;
- whether the recommendation matched your initial professional view;
- what you would check before giving a customer an indication;
- what wording felt too certain or unclear;
- the most important improvement before client-facing use.

### Feedback template

```text
Reviewer:
Date:
Property/test case:

Did the address and parcel look correct?
Did the map look recognisable and useful?
Did the suggested pool locations look realistic?
What did the tool identify correctly?
What important site factor was missing?
Did the recommendation match your professional view?
What would you check before giving a customer an indication?
What wording should change?
What is the most important improvement before client-facing use?
Overall view: proceed / revise / stop
```

## Bottom line

The useful outcome at this stage is not a yes/no answer. It is a clear list of what appears possible from desktop information, what may change the design, what must be verified onsite or by another professional, and what should improve before a customer sees the result.

The tool should remain an internal preliminary screening aid until its evidence, rules, professional review process, disclaimers, privacy controls, and client-facing wording have been validated.
