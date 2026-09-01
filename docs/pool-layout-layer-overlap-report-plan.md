# Pool layout mapped-layer overlap reporting plan

## Purpose

Make the saved preliminary report consistently explain when the selected pool
layout overlaps one or more relevant mapped layers. The report must not show a
category as `Appears suitable` when the selected pool shell or its indicative
construction/excavation buffer has triggered a mapped-layer warning in that
category.

This is a reporting and assessment-presentation change. It remains a desktop
screening tool: mapped geometry is indicative and does not replace a service
locate, survey, engineering design, consent check, or service-owner approval.

## Problem being addressed

The current placement warning can correctly identify a reliable mapped utility
overlap, but it is stored as one combined message, such as:

> The pool overlaps reliable mapped stormwater pipe infrastructure. Mapped
> wastewater pipes position also needs checking.

The saved report then derives the individual `At a glance` statuses from broad
layer availability and general risks. This can leave `Stormwater` shown as
`Appears suitable` even when the selected pool layout triggered the warning.

## Desired report behaviour

### What is assessed

Assess both of the following against every relevant mapped layer:

1. The selected pool shell.
2. Its indicative construction/excavation buffer.

The buffer is deliberately included because excavation and construction can be
affected even if the final pool shell only narrowly misses a mapped asset.

Relevant layers include:

- Stormwater pipes, watercourses, catchpits, culverts, and manholes.
- Wastewater, water, gas, electricity, associated fittings, and manholes.
- Flooding, drainage, planning, and other configured mapped exclusions.
- Building footprints and the mapped property boundary for the `Pool fit`
  result.

Contours remain terrain evidence; a contour crossing the pool is not, by
itself, a service conflict.

### Status rules

| Evidence at the selected layout | At a glance result | Meaning |
| --- | --- | --- |
| A reliable, report-eligible mapped layer intersects the shell or buffer | `Potential Constraint` | Do not treat the present layout as clear; review, move, or obtain an accepted engineered/service-owner solution. |
| An indicative, internal-reference, partial, or otherwise unverified mapped layer intersects the shell or buffer | `Further investigation required` | Confirm actual position, depth, clearance, and any requirements before finalising the layout. |
| Complete, usable evidence has no relevant intersection | `Appears suitable` | No mapped overlap was identified; normal site verification still applies. |
| Required evidence was unavailable or incomplete | `Not assessed` | The category cannot be safely assessed from this report. |

Where several mapped layers affect one category, use the highest-severity
result. `Pool fit` shows the highest result across the entire selected layout.

### Expected output

For the example where the pool overlaps a reliable stormwater pipe and has an
unverified wastewater-pipe overlap:

#### At a glance

| Category | Short result |
| --- | --- |
| Pool fit | `Potential Constraint` |
| Water & wastewater | `Further investigation required` |
| Stormwater | `Potential Constraint` |
| Flooding & drainage | `Appears suitable` (if checked and clear) |
| Terrain | `Appears suitable` (if checked and clear) |
| Planning | `Appears suitable` (if checked and clear) |
| Pool safety barrier | `Further investigation required` |
| Construction access | `Not assessed` |

#### Key findings

Keep the detailed explanation here, rather than repeating it in each status
cell:

> **Pool position needs review**<br>
> The pool overlaps reliable mapped stormwater pipe infrastructure. Mapped
> wastewater pipe position also needs checking.

If additional relevant layers overlap, name each one plainly in the same
finding (for example, gas or a mapped flood exclusion), without treating all
visible map lines as a conflict.

## Implementation steps

### 1. Return structured overlap findings from the placement classifier

**Files:** `src/modules/data-access-spike/fast-pool-warning.ts` and its tests.

Replace the report-facing reliance on only `conflictingDatasets`,
`checkingDatasets`, and one formatted sentence with structured per-layer
findings. Each result will retain, at minimum:

- dataset key and customer-facing dataset name;
- report category (`stormwater`, `water_wastewater`, `flooding_drainage`,
  `planning`, or `pool_fit` as applicable);
- whether the shell/buffer intersects the layer;
- evidence reliability; and
- derived status: potential constraint or further investigation.

Keep the existing aggregate warning message and recommendation for the
interactive map and compatibility, but compose it from the structured results
so wording cannot drift.

### 2. Use the selected layout and map geometry consistently

**Files:** `src/components/fast-property-view.tsx`,
`src/modules/assessment/server-assessment-submission.ts`, and placement tests.

Confirm that the same selected layout geometry used in the interactive warning
is used at submission time. The server remains the source of truth: it
recomputes overlap findings from the trusted snapshot and the construction
buffer rather than trusting a browser-supplied status.

Map each checked layer to its correct customer-facing category. A reliable
stormwater-pipe overlap therefore affects `Stormwater`, while a wastewater-pipe
overlap affects `Water & wastewater`; both also influence the overall `Pool
fit` result.

### 3. Persist the structured results with a saved assessment

**Files:** `src/modules/assessment/persisted-assessment.ts` and
`src/modules/assessment/server-assessment-submission.ts`.

Add a bounded, validated `placementLayerFindings` field to the persisted report
data. Save the per-layer category, label, status, and evidence reliability
alongside the already saved layer geometry/provenance.

Existing reports have no such snapshot. Their current display must remain
readable using the legacy fallback; they must not be retrospectively presented
as newly verified placement results.

### 4. Derive report categories from the saved placement findings

**Files:** `src/modules/reporting/pool-feasibility-report.ts` and
`src/modules/reporting/preliminary-report.ts`.

Update the canonical report builder so each `At a glance` category first uses
the persisted placement findings that belong to it. It will select the highest
status for that category. General layer availability remains the fallback only
when no saved placement finding applies.

Keep `Key findings` as the long, consolidated explanation. This preserves a
quick scan at the top of the report while still telling the homeowner exactly
which mapped layers caused the result.

### 5. Confirm web and PDF presentation use the same canonical output

**Files:** report presentation/HTML components and focused renderer tests, as
identified during implementation.

Retain the short, status-only `At a glance` cells. Do not duplicate the long
warning there. Ensure the saved interactive report and its PDF use the same
canonical report model, labels, colours, and ordering.

## Testing and validation

Add or extend tests for the following cases:

1. Reliable stormwater overlap: `Pool fit` and `Stormwater` are `Potential
   Constraint`; the key finding names the stormwater pipe.
2. Indicative wastewater overlap: `Water & wastewater` is `Further
   investigation required`; the key finding asks for position confirmation.
3. Multiple overlaps across categories: each category receives its own highest
   short status and the key finding describes all affected layers.
4. A complete, clear layer: it remains `Appears suitable`.
5. Unavailable or partial evidence: it is `Not assessed` or `Further
   investigation required`, never green by implication.
6. A contour crossing the pool: it does not create a utility overlap; terrain
   is evaluated only under terrain rules.
7. Historic saved report without structured findings: legacy fallback renders
   without errors or a false new assurance.
8. Interactive saved report and PDF/HTML renderer: both display identical
   short statuses and the same key-finding text.

Run, at minimum:

```powershell
npm test -- --run tests/unit/fast-pool-warning.test.ts
npm test -- --run tests/integration/fast-pool-warning.test.ts
npm test -- --run tests/unit/report-presentation-consistency.test.tsx
npm run typecheck
npm run lint
npm run build
git diff --check
```

Add the relevant report-rendering and browser journey tests to that focused set
once their exact files are updated.

## Acceptance criteria

- A mapped layer that intersects the selected pool shell or construction buffer
  cannot be shown as `Appears suitable` in its own category.
- All affected categories are represented when several layers overlap.
- `At a glance` is concise; `Key findings` carries the human-readable detail.
- The report distinguishes reliable constraints from indicative evidence that
  needs verification.
- No browser-supplied overlap result is trusted when saving the report.
- Existing saved reports remain viewable and are not silently reclassified.
- Web and PDF reports present the same saved assessment.
