# Three-page preliminary report contract

## Rendering model

Build one saved `GeneratedReport` view model and render it into both the interactive report page and a print-only HTML route. The PDF generator consumes only that persisted model and pre-rendered/static map imagery derived from the same verified geometries. It must not call live GIS providers during PDF rendering.

MT-249 implements this as `SavedPreliminaryReport`. The assessment response returns that model
immediately for browser display. The PDF renderer and both email destinations consume the same
saved model and map capture. During the ADR-0005 controlled test, the submitted synthetic test
email and `support@bluehaven.nz` receive the same PDF bytes and filename. ServiceM8 delivery
remains disabled.

HTML-to-PDF is preferred, but the browser binary/runtime is not selected until a Vercel deployment spike proves compatibility, cold-start and bundle limits, A4 pagination, map capture, and attribution. Playwright is installed for application and E2E testing; that does not yet prove it is the production PDF runtime.

## Page contract

### Page 1 — Property and saved map

PoolReady branding, address, report date/ID, proposed pool, a full-width text-only overall warning and recommendation, a compact `At a glance` status scan, and one saved aerial map. The captured map layers and indicative pool-shell clearances sit below the map; the layer list uses three equal columns. Do not repeat the map on another page.

### Page 2 — What we checked

Compact cards for meaningful assessed results, including approved indicative terrain measurements when available; unavailable or unassessed checks appear in one `Still needs checking` list rather than empty cards. Include key findings without duplicating the map, score, scenarios, or status table. Building-outline geometry remains omitted from the customer map and legend to keep the aerial readable.

### Page 3 — Next steps and provenance

Recommended next stage, actionable steps and remaining verification, followed by mapping sources, licences, assumptions, limitations, and the preliminary-assessment disclaimer. Keep the complete provenance for any report-eligible terrain measurement compact and readable.

Each A4 page carries `Preliminary Feasibility Report`, report ID, page number, and generated timestamp. Map attribution must remain legible in print.

## Map fidelity

- Use real aerial imagery only when the licence permits static report reproduction.
- Use the same saved geometry source for web and PDF layers.
- Grey means unavailable/unknown; it is never a guessed asset.
- Screening distances are labelled `Indicative investigation buffer` unless backed by a verified rule.
- A map-render failure produces `REPORT_GENERATION_FAILED`; it does not substitute a fictional image.

## Acceptance checks

- Exactly three A4 pages at the supported viewport/font configuration.
- No clipped legends, tables, footers, or attribution.
- PDF metadata and report timestamps are deterministic for a saved fixture.
- The download route returns the correct content type, disposition, safe filename, and error code.
- Visual regression uses controlled map/provider fixtures and a licensed test tile strategy.
