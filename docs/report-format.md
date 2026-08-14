# Three-page report proposal

## Rendering model

Build one saved `GeneratedReport` view model and render it into both the interactive report page and a print-only HTML route. The PDF generator consumes only that persisted model and pre-rendered/static map imagery derived from the same verified geometries. It must not call live GIS providers during PDF rendering.

MT-249 implements this as `SavedPreliminaryReport`. The assessment response returns that model
immediately for browser display. The PDF renderer and both email destinations consume the same
saved model and map capture. During the ADR-0005 controlled test, the submitted synthetic test
email and `support@royalglass.co.nz` receive the same PDF bytes and filename. ServiceM8 delivery
remains disabled.

HTML-to-PDF is preferred, but the browser binary/runtime is not selected until a Vercel deployment spike proves compatibility, cold-start and bundle limits, A4 pagination, map capture, and attribution. Playwright is installed for application and E2E testing; that does not yet prove it is the production PDF runtime.

## Page contract

### Page 1 — Executive summary

Address, report date/ID, score, classification, confidence, main recommendation, three scenario results, top three risks, and main aerial map.

### Page 2 — Property constraints

Large attributed map with parcel, candidates and report-eligible verified hazards/infrastructure/terrain, plus the six-category status table. Building-outline geometry is deliberately omitted from the customer map and legend to keep the aerial readable; it remains available to the assessment and in the Page 3 official-layer status.

### Page 3 — Risks and actions

Risk table, prioritised actions by phase, missing information, data sources, assumptions, limitations, and disclaimer.

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
