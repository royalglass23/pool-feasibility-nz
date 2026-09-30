# Audience-aware preliminary report contract

## Rendering model

Build one saved `SavedPreliminaryReport` view model and render it into both the interactive report page and a print-only HTML route. The PDF generator consumes only that persisted model and the saved map capture derived from the same verified geometries. It must not call live GIS providers during PDF rendering.

The persisted `reportAudience` selects a presentation projection, not a second
analysis. Homeowner output omits builder-only depth, excavation, route,
constructability, detailed-source, and provenance material. Pool Builder output
retains the applicable technical evidence and the supplied company name. Staff
continues to see the complete trusted saved record for audit and review.

MT-249 implements this as `SavedPreliminaryReport`. The assessment response returns that model
immediately for browser display. The PDF renderer and both email destinations consume the same
saved model and map capture. During the ADR-0005 controlled test, the submitted synthetic test
email and `support@bluehaven.nz` receive the same PDF bytes and filename. ServiceM8 delivery
remains disabled.

The current HTML-to-PDF implementation uses Puppeteer Core with `@sparticuz/chromium`. Playwright is used for application and E2E testing. Runtime compatibility, cold starts, A4 pagination, map capture, and attribution still require verification on the exact deployment target before release sign-off.

## Homeowner page contract

The Homeowner attachment is fixed at exactly three A4 pages.

### Page 1 — Property and saved map

PoolReady branding, address, report date/ID, proposed pool, a full-width text-only overall warning and recommendation, a compact `At a glance` status scan, and one saved aerial map. The captured map layers and indicative pool-shell clearances sit below the map; the layer list uses three equal columns. Do not repeat the map on another page.

### Page 2 — What we checked

Compact cards for meaningful assessed results, including approved indicative terrain measurements when available; unavailable or unassessed checks appear in one `Still needs checking` list rather than empty cards. Include key findings without duplicating the map, score, scenarios, or status table. Building-outline geometry remains omitted from the customer map and legend to keep the aerial readable.

For newly saved reports, the four headline DEM slope metrics describe the
buffered proposed-pool construction envelope, not the whole parcel. Older
saved parcel-wide measurements retain their original labels. If the selected
envelope cannot be assessed, show `Needs checking` rather than reusing a
parcel-wide slope as the pool-area result.

### Page 3 — Next steps and guidance

Page 3 contains the recommended next stage, plain-language guidance about what
the pool builder will confirm, and the preliminary-assessment disclaimer.
Detailed source, constructability, and provenance material stays in the trusted
saved assessment and is not exposed through the Homeowner projection.

Each Homeowner A4 page carries `Preliminary Feasibility Report`, report ID,
page number, and generated timestamp. Pool Builder pages carry the report title,
report ID, and generated timestamp without claiming a fixed page count. Map
attribution must remain legible in print.

## Pool Builder report contract

The Pool Builder attachment uses the same three logical sections and saved map,
but retains applicable constructability findings, depth and excavation
assumptions, suggested-route evidence, detailed source credits, and limitations.
It normally renders as three A4 pages and may expand when complete readable
evidence needs more room. Individual evidence items and headings must not be
split into an unreadable layout; generation fails rather than clipping an
unbreakable item. Builder footers do not claim a fixed page count.

## Map fidelity

- Use real aerial imagery only when the licence permits static report reproduction.
- Use the same saved geometry source for web and PDF layers.
- Grey means unavailable/unknown; it is never a guessed asset.
- Screening distances are labelled `Indicative investigation buffer` unless backed by a verified rule.
- A map-render failure produces `REPORT_GENERATION_FAILED`; it does not substitute a fictional image.

## Acceptance checks

- Exactly three A4 pages for the Homeowner projection at the supported
  viewport/font configuration; Pool Builder output may expand when required.
- No clipped legends, tables, footers, or attribution.
- PDF metadata and report timestamps are deterministic for a saved fixture.
- The signed PDF route returns the correct content type, disposition, safe filename, and error code; browser report views do not offer a PDF download control.
- Visual regression uses controlled map/provider fixtures and a licensed test tile strategy.
