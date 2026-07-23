# Pool Feasibility Tool - Professional Feedback Guide

**Purpose:** help a pool professional review an early Auckland screening tool and advise what it needs before it can become a concise, accurate, client-facing feasibility aid.

**Status:** internal, Auckland-only proof of concept. This is a preliminary desktop screening tool, not a consent, engineering, survey, title, utility-location, geotechnical, construction-safety, or final design service.

## 1. What the tool is intended to do

The tool takes an Auckland residential property address and produces a preliminary, evidence-led screen:

1. Resolves the requested address against LINZ address data.
2. Confirms the legal parcel containing the resolved address point.
3. Retrieves available mapped datasets and records their source, date, licence, attribution, and confidence.
4. Tests configured pool shell sizes, rotations, setbacks/working allowances, buildings, mapped constraints, and mapped services.
5. Produces a deterministic feasibility score, a separate data-confidence level, critical flags, risks, follow-up actions, and an explanation.
6. Allows the staff user to download the current session assessment as bounded JSON and preview/download a session PDF where the local renderer is available.

The output is a screening aid. It must not be read as “a pool can definitely be built here” or “no constraint exists.” Missing or unavailable information is kept as unknown and should reduce confidence or trigger follow-up work.

## 2. How to access the production site

Open the Vercel production site in a desktop browser:

**Production URL:** `[insert Vercel production URL]`

When prompted for Royal Glass staff access, use:

**Username:** `[insert production username]`  
**Password:** `[insert production password]`

Keep these credentials confidential and share them only with the intended professional reviewer. Do not include them in screenshots, feedback tickets, source control, or public documents.

The result is session-scoped: refreshing or closing the browser can lose it unless the reviewer downloads the JSON assessment. No database or durable assessment history is part of this POC.

For a controlled first walkthrough, use one of these test addresses:

- `42A Bahari Drive, Ranui, Auckland`
- `2/49 Pigeon Mountain Road, Half Moon Bay, Auckland`

These are controlled test inputs, not product defaults. The tool accepts other supported Auckland addresses.

## 3. Recommended walkthrough

### Step 1 — Enter the address correctly

The address bar is strict. Enter one complete property address in a single line using this format:

`[unit number/]street number and suffix street name street type, suburb, Auckland`

Examples:

- `42A Bahari Drive, Ranui, Auckland`
- `2/49 Pigeon Mountain Road, Half Moon Bay, Auckland`

For the best match:

- include the unit number when the property is a unit, apartment, or rear dwelling;
- include the exact street number and suffix, such as `42A`, rather than changing it to `42`;
- spell the street name and suburb normally;
- include the street type, such as `Road`, `Drive`, `Street`, or `Avenue`;
- include `Auckland` at the end;
- do not enter a business name, legal description, parcel ID, map coordinates, or a general suburb-only search;
- do not paste multiple addresses into the field.

The safest pattern is: **unit/street number, street name and type, suburb, Auckland**. If the application returns more than one match, select the exact full address shown in the options. Never choose a similar address by assumption; the application intentionally distinguishes, for example, `42A` from `42`.

### Step 2 — Confirm property identity

Before reading the feasibility result, check:

- resolved full address;
- LINZ address ID;
- parcel ID and legal description/appellation;
- address point shown inside the parcel boundary;
- whether the parcel is explicitly confirmed rather than merely found nearby;
- aerial imagery and visible LINZ attribution.

If the property identity is wrong or ambiguous, stop. Do not interpret the score.

### Step 3 — Read “Property map and official evidence”

Use the map for orientation only. It shows the confirmed parcel, address point, aerial imagery, and available mapped evidence. Aerial imagery is not a survey and may be stale or have variable capture date/resolution.

For each dataset, read these fields together:

| Field | Meaning |
|---|---|
| Status | Whether the provider returned usable data for this session. `success`/`available` means data was returned; `unavailable` or `error` means it must not be read as an empty result. |
| Evidence use | Whether the data may support a generated report: `report_allowed`, `spike_only`, `internal_reference`, or `unavailable`. |
| Confidence | Confidence in that dataset result, not confidence that the property is feasible. |
| Feature count | Number returned from the bounded query envelope. It is not automatically the number intersecting the parcel or a pool candidate. |
| Source/attribution/date | Provenance needed to judge currency, licensing, and whether the evidence is suitable for reuse. |

Evidence-use meanings:

- **Report allowed:** permitted for the current report evidence boundary, subject to its limitations.
- **Spike only:** technically queried during investigation, but reuse in a generated report is not yet cleared. Current Auckland Council layers are in this category.
- **Internal reference:** visible for internal context only and not report evidence. Current Watercare layers are in this category because licence restrictions remain unresolved.
- **Unavailable:** no usable evidence was obtained; this is unknown, not proof of absence.

### Step 4 — Read “Pool scenarios”

The tool tests configured shell sizes and rotations using deterministic geometry. It considers the parcel, mapped building footprints, configured construction allowance, and available mapped constraints/services.

For each scenario, check:

- shell dimensions and construction allowance;
- number of placements and rotations tested;
- whether candidates were found;
- candidate ranking and the evidence used for ranking;
- constraints marked measured versus unavailable;
- mapped service distances, remembering that a mapped service is not a BeforeUdig plan or onsite locate.

“No clear candidate area was identified using the tested screening scenarios” means no candidate passed the tested geometric rules. It does not mean that every possible design is impossible; a different design, verified survey, or specialist assessment may change the outcome.

### Step 5 — Read “Feasibility assessment”

The result has two deliberately separate judgements:

1. **Feasibility score:** a preliminary physical screening result based on known, tested evidence.
2. **Data confidence:** how complete and dependable the evidence base is.

Do not combine them into one certainty percentage. A high score with low confidence means “the known evidence looks favourable, but important evidence is missing or weak.” A lower score with high confidence means “the measured evidence reliably identifies constraints.”

Current score bands:

| Score | Normal band |
|---:|---|
| 85–100 | Strong preliminary candidate |
| 70–84 | Likely feasible with normal investigations |
| 50–69 | Potentially feasible but constrained |
| 30–49 | Significant constraints |
| 0–29 | Low preliminary feasibility |

The score is based on six categories: available space/layout (25), underground services (20), flooding/drainage (20), terrain/slope (15), planning constraints (10), and desktop construction access (10). Critical flags can qualify or override the normal band without changing the recorded arithmetic.

Interpret category cards as follows:

- `x / maximum`: known evidence supported an awarded result.
- `Unknown / maximum`: the category could not be fully assessed; do not treat it as zero.
- `Critical flag`: a material issue that requires attention even if the normal score looks acceptable.
- `Indeterminate`: the available evidence is insufficient to make a responsible physical classification.

### Step 6 — Read risks, actions, sources, and limitations

These sections are the handoff checklist, not optional footnotes. They identify what must be verified before design or customer advice, such as title/easements/covenants, private services, exact stormwater/wastewater/electricity/gas locations and depths, geotechnical conditions, groundwater, retaining walls, access, barriers, and approvals.

### Step 7 — Save the evidence

Download **Assessment data** before closing or refreshing the browser. The JSON is a bounded session snapshot intended for technical review; it excludes raw provider payloads and credentials. If a PDF is generated, treat it as a session artefact, not a durable record or approval document.

## 4. How to interpret common outcomes

| Outcome | Correct reading | Immediate action |
|---|---|---|
| Strong preliminary candidate + high confidence | Known mapped evidence and tested rules are favourable. | Proceed only to the normal investigation/design gates; do not skip site verification. |
| Favourable score + low confidence | The visible result is promising but evidence coverage is weak. | Identify unavailable datasets and obtain survey, title, utility, or specialist evidence before relying on it. |
| Significant constraints | Known evidence materially reduces the tested opportunity. | Review the critical flags and candidate geometry; seek a design response or specialist opinion. |
| Indeterminate | There is not enough evidence to classify physical feasibility responsibly. | Resolve parcel/core-data issues or stop the assessment. |
| No clear candidate area | No tested shell/rotation passed the current rules. | Treat as a failed screening configuration, not a universal impossibility finding. |
| Provider unavailable/error | The dataset could not be used. | Retry, check provider credentials/connectivity, and record the resulting confidence limitation. |

## 5. Error codes and what to do

### Address, parcel, and request errors

| Code | Meaning | What to do now |
|---|---|---|
| `INVALID_ADDRESS` | The request is missing, too short/long, malformed, or is not a complete address. | Enter a complete Auckland street address, for example `42A Bahari Drive, Ranui, Auckland`. |
| `ADDRESS_FORMAT_UNSUPPORTED` | The supplied format could not be interpreted by the address resolver. | Use a normal street-address format with number/unit, street, suburb, and Auckland. |
| `ADDRESS_NOT_FOUND` | No exact Auckland address match was returned. | Check spelling, unit/number, suburb, and postcode; retry with the LINZ-style address. |
| `ADDRESS_AMBIGUOUS` | Multiple address matches are plausible. | Select the exact address option; do not continue by guessing. |
| `PARCEL_NOT_FOUND` | The resolved address point did not fall within a returned legal parcel. | Stop and manually review the address/parcel relationship; this may require cadastral or survey review. |
| `PARCEL_AMBIGUOUS` | More than one parcel contains the address point. | Stop and identify the correct legal parcel manually. |
| `PARCEL_UNCONFIRMED` | The legal parcel could not be confidently confirmed or distinguished from alternatives. | Do not interpret feasibility. Confirm the parcel using authoritative cadastral/title information. |
| `OUTSIDE_SUPPORTED_REGION` | The POC currently supports Auckland only. | Do not use the result for another region; a regional expansion needs its own data, rules, licensing, and validation. |
| `INVALID_REQUEST` | The API body is not valid JSON or is not the expected request shape. | Retry through the application UI. If it persists, capture the correlation ID and browser/server logs for engineering review. |
| `REQUEST_TOO_LARGE` | The submitted request exceeded the safety limit. | Submit one address only; do not paste large JSON, raw provider data, or map payloads into the request. |

### Access and provider errors

| Code | Meaning | What to do now |
|---|---|---|
| `UNAUTHORIZED` | The request is not authenticated as Royal Glass staff. | On local development use `localhost`; otherwise use the configured staff Basic Auth credentials. |
| `ACCESS_CONTROL_MISCONFIGURED` | The non-loopback/deployed environment has no paired internal access credentials configured. | Configure both `INTERNAL_ACCESS_USERNAME` and `INTERNAL_ACCESS_PASSWORD`; do not bypass the access check. |
| `DATA_PROVIDER_ERROR` | An official provider failed during address, parcel, or mapped-data retrieval. | Retry once, then check provider availability, server-only credentials, timeout, and correlation ID. Treat affected evidence as unknown. |
| `PROVIDER_TIMEOUT` | A provider did not answer within the bounded timeout. | Retry later; if repeated, investigate provider latency or timeout settings. Do not convert the timeout to “no feature.” |
| `PROVIDER_RESPONSE_INVALID` | The provider response did not match the expected schema or geometry shape. | Preserve the error, inspect the provider contract/fixture, and update the adapter only after review. |
| `PROVIDER_RESPONSE_TOO_LARGE` | The provider returned more data than the safety limit. | Narrow the query envelope or add a bounded server-side pagination/aggregation strategy; do not raise limits casually. |
| `PROVIDER_HTTP_ERROR` | The provider returned an HTTP failure response. | Check provider status, endpoint, credentials, licence/access changes, and retry policy. |
| `PROVIDER_REQUEST_FAILED` | The request could not be completed for another provider/network reason. | Retry, then inspect safe server diagnostics using the correlation ID. Never expose keys, URLs with secrets, raw payloads, or stack traces. |
| `AERIAL_IMAGERY_UNAVAILABLE` | Aerial tiles or their style/attribution could not be loaded. | Check `LINZ_BASEMAPS_API_KEY`, tile-route configuration, network access, and attribution response; use the assessment only with reduced evidence confidence. |
| `AERIAL_PROVIDER_ERROR` | The aerial provider returned an error while loading imagery. | Check the LINZ Basemaps endpoint/key and retry. Aerial imagery failure must not be read as a site constraint. |
| `INVALID_TILE` | The tile request path/coordinates are invalid. | Retry from the application map; if reproducible, capture zoom/x/y and correlation ID for engineering. |

### Analysis and report errors

| Code | Meaning | What to do now |
|---|---|---|
| `REQUIRED_DATA_UNAVAILABLE` | Core evidence needed for a responsible analysis is missing. | Stop or treat the result as indeterminate; obtain the missing evidence rather than assuming a negative result. |
| `ANALYSIS_FAILED` | The assessment orchestration failed unexpectedly. | Retry once. If repeated, download any available evidence, record the correlation ID, address, time, and failing step. |
| `REPORT_GENERATION_FAILED` | The report data/map image was invalid, or the renderer failed. | Use **Print / save PDF** as the immediate fallback; retain the assessment JSON and report the correlation ID. |
| `REPORT_RENDERER_BUSY` | The PDF renderer is at capacity. | Wait briefly and retry; the response supplies a short retry interval. |
| `REPORT_RENDERER_TIMEOUT` | PDF generation exceeded its time limit. | Retry once, then use browser print/save PDF and investigate renderer performance. |

Correlation IDs are safe support references. Give the reviewer/engineer the ID, exact address, approximate time, and visible error code. Do not send credentials, raw provider responses, or secrets.

## 6. Dataset-specific cautions

- LINZ address and parcel data are the identity foundation, but cadastral mapping is not a site survey.
- LINZ building footprints may be stale or omit later structures.
- Aerial imagery is orientation evidence, not survey-grade measurement.
- Auckland Council contours, planning, flooding, flow-path, stormwater, and related layers are currently `spike_only`; successful technical retrieval does not mean generated-report reuse is cleared.
- Watercare geometry is `internal_reference`; it must not be treated as report evidence or complete utility information.
- Vector electricity and gas geometry is open reference evidence but can be incomplete or inaccurate. It is not a substitute for BeforeUdig plans, provider confirmation, or onsite locating.
- Culverts are currently unavailable because no dedicated official endpoint was verified in the spike.
- A zero feature count means “zero returned by this bounded query,” not “the real-world asset is absent.”

## 7. What professional feedback would be most useful

Please ask the reviewer to comment on:

1. Whether the distinction between feasibility score and data confidence is clear.
2. Whether a non-technical reader could mistake the result for approval or certainty.
3. Whether the parcel/address confirmation is sufficiently prominent before the score.
4. Whether each error message gives an appropriate next action.
5. Whether the candidate geometry and construction allowance are understandable and defensible.
6. Whether unknown, unavailable, `spike_only`, and `internal_reference` evidence are clearly differentiated.
7. Which missing evidence would materially change a real preliminary pool screen.
8. Whether the current score categories, critical flags, and result bands reflect professional practice.
9. What title, survey, utility, planning, geotechnical, drainage, access, or consent checks must be mandatory before customer-facing use.
10. Which statements require a qualified planner, surveyor, engineer, geotechnical professional, utility locator, or legal/title specialist.

Suggested review record:

```text
Reviewer:
Date:
Property/test case:

What appears useful:
What is misleading or too confident:
Missing evidence or checks:
Errors that need clearer wording:
Scoring/rules concerns:
Licensing/provenance concerns:
Recommended next gate:
Overall view: proceed / revise / stop
```

## 8. Current boundary before further work

The correct next step is professional validation of the wording, evidence model, scoring assumptions, and mandatory follow-up checks. The POC should remain internal and Auckland-only until that feedback is reviewed. External/customer release, national expansion, durable history, and production deployment are not implied by a successful local run.

Related technical documents:

- [Product limitations](limitations.md)
- [Scoring model](scoring.md)
- [Official data-source register](data-sources.md)
- [Architecture and error contract](architecture.md)
- [Internal release readiness](release-readiness.md)
