# 07 — Generate the three-page attributed PDF

## Parent

`famiglia/geomap-intial/contract.md`

## What to build

Prove and implement a Vercel-compatible PDF renderer that transforms the saved report snapshot into exactly three A4 pages with real map content, required attribution, stable headers/footers, and safe download behavior.

## Acceptance criteria

- [ ] Deployment spike proves renderer binary size, cold start, timeout, fonts, map capture, and three-page pagination on Vercel preview.
- [ ] PDF never re-queries live GIS or invents a map when rendering fails.
- [ ] Pages contain the contracted executive, constraints, and risks/actions content.
- [ ] Every page includes title, report ID, generated timestamp, and page number.
- [ ] Maps use saved verified geometry/imagery under confirmed static-report rights with legible attribution.
- [ ] Download response has safe filename/content headers and stable `REPORT_GENERATION_FAILED` behavior.
- [ ] Page-count, text extraction, deterministic fixture, and visual clipping/attribution checks pass.
- [ ] Durable storage versus on-demand generation is decided and documented.
- [ ] Typecheck, lint, tests, build, preview-runtime proof, and generated-artifact inspection pass.

## Blocked by

Job 06 and Job 01 aerial static-reproduction rights.
