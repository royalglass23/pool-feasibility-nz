# Changelog

This file summarises meaningful product changes from the Git history. The
project does not currently use tagged releases, so entries are grouped by the
date they reached the shared integration history. Items under **Unreleased** may
exist only in the local working tree. This is a code-change record, not proof
that a change was deployed or enabled in production.

## Unreleased

### Engineering gates

- Separated the public-input attack suite from ordinary browser tests so each
  lane runs with its intended database and delivery boundary.
- Made the general browser gate deterministic with one worker, zero retries,
  retained failure traces, and current expectations for canonical addresses,
  friendly errors, and Staff Admin authentication.
- Pinned compatible formatting tooling across npm and pnpm and documented the
  repository line-ending policy.

### Documentation

- Replaced the original internal-POC README with an onboarding guide for the
  current public Property Check, persisted reports, staff workspace, and
  operational boundaries.
- Added a first-reader documentation map, documented the implemented database,
  and refreshed the release-evidence guide.
- Added a testing guide and deployment/rollback runbook, and recorded the exact
  boundary between the green local candidate and outstanding target checks.
- Updated professional-review onboarding for the anonymous Property Check and
  removed obsolete production-login and report-download instructions.

## 18 September 2026

### Documentation

- Brought the product overview, report contract, dependency roles, and
  release-evidence pointers up to date with the September changes.

### Report and Property Check maintenance

- Kept page three of the preliminary PDF focused on next steps, grouped source
  credits, assumptions, and the disclaimer.
- Removed unused Property Check code and default scaffold assets, and clarified
  the current component and dependency documentation.
- Preserved the fields PostHog needs to accept consented, anonymous funnel
  events while continuing to reject unapproved event fields.

## 17 September 2026

### Indicative terrain and preliminary report

- Enabled Auckland 2024 LINZ LiDAR DEM measurements in detailed checks and
  eligible saved reports. New reports describe the buffered proposed-pool
  construction area; older saved parcel-wide measurements retain their labels.
- Required controlled DEM source and asset provenance before displaying a
  measured slope in the report. Unavailable or ineligible terrain remains
  **Needs checking**.
- Refined the preliminary PDF into three pages: property and saved map,
  assessed results and remaining checks, then next steps and source credits.
- Stabilised report rendering and the constructability evidence boundary; the
  wider site-constructability journey remains planned work.

### Analytics

- Added consent-gated PostHog events for the anonymous Property Check funnel,
  including a bounded email-delivery outcome observed by the visitor's browser.
  Automatic capture and session recording remain disabled.

## 15-16 September 2026

### Property Check map

- Added an indicative relative slope display across mapped parcel terrain and
  refined the pool-area calculation, including DEM tile-boundary handling.
- Improved mobile map layout, layer controls, property notices, pool guidance,
  and recovery after a constrained detailed-check request.
- Refreshed the homepage journey illustrations and copy.

## 11-14 September 2026

### Terrain foundation

- Added the bounded Auckland DEM reader and property-specific indicative slope
  foundation. Provider coverage and source checks remain explicit so missing
  terrain evidence cannot appear as a clear result.

## 10 September 2026

### Security and reliability

- Upgraded production dependencies and recorded a clean npm and pnpm production
  dependency audit for commit `5e34e16`.
- Made MapLibre worker loading explicit so mapped property views work in the
  production bundle.
- Improved public form validation, accessible feedback, focus handling, and
  recovery for homeowner, general-contact, and partnership submissions.
- Standardised calm inline errors across public inputs while allowing ordinary
  company punctuation such as apostrophes and ampersands.
- Passed the isolated public-input safety suite with injection-shaped,
  malformed, control-character, oversized-input, persistence, and data-leakage
  coverage; the broader deployment sign-off remained blocked on target checks.

## 9 September 2026

### Founding Partner Program

- Added the `/partners` journey, BlueHaven attribution, partner-specific enquiry
  handling, benefit cards, and a revised hero/navigation treatment.

### Public-input hardening

- Tightened names, email addresses, phone numbers, messages, honeypots, request
  sizes, and database-environment guards.
- Expanded unit, browser, and security-host coverage for hostile and malformed
  input while keeping returned errors calm and free of submitted values.

### Product polish

- Clarified first-time address guidance and aligned the homepage process icons
  and step numbering.

## 8 September 2026

### Reports and analytics

- Removed browser PDF download controls from homeowner and staff report views;
  emailed PDF delivery remains the supported visitor path.
- Aligned PDF branding and support delivery with PoolReady and BlueHaven.
- Added consent-gated Vercel Speed Insights and repaired the deployment
  lockfile.
- Ignored local load-test research and generated review artefacts while keeping
  the reusable scripts local and uncommitted.

## 7 September 2026

### Property Check experience

- Reshaped the journey around four plain-language steps: find the property,
  position the pool, check constraints, and request the report.
- Improved pool dragging and rotation, map styling, loading/recovery guidance,
  and report snapshot timing.
- Kept detailed mapped checks opt-in and prevented transient map layers or
  controls from leaking into the saved report image.
- Added consent-gated Metricool support without changing the existing privacy
  boundary.

## 1-3 September 2026

### Addressing and evidence

- Added a local PostgreSQL-backed LINZ address-search index with guarded
  development and production import/status/probe commands.
- Isolated Vercel Preview database selection from the production database.
- Added mapped pool-layer overlap reporting and exposed gas/electricity findings
  in the report.

### Report communication

- Added a web-report reading guide and clearer pool-position warnings.
- Branded report emails as PoolReady, improved logo contrast, and included
  bounded report details in the support copy.

## 17-20 August 2026

### PoolReady identity and usability

- Renamed PoolLab to PoolReady and introduced the current logo, palette,
  favicon, property-search flow, homepage imagery, and plain-language report
  positioning.
- Added consent-gated Hotjar support, restricted to the public Property Check.
- Added the privacy-safe support contact form and shared site footer.

### PDF and map stability

- Stabilised Chromium PDF rendering and restored missing findings.
- Corrected saved-map alignment, legends, line rendering, clearance labels,
  pagination, and footer collisions.
- Patched the then-current Next.js production security advisories.

## 5-14 August 2026

### Public discovery foundation

- Opened the anonymous homeowner Property Check while keeping saved records and
  staff pages behind a database-backed Admin session.
- Added assessment persistence, visitor-context minimisation, scheduled
  retention, privacy-request handling, distributed rate limits, and
  consent-gated analytics.
- Separated the homeowner PDF from the reduced operational notification and
  added preview-safe email testing controls.
- Added saved report maps, report redesigns, delivery recovery, and production
  PDF support.

## 16-31 July 2026

### Initial Auckland POC

- Bootstrapped the standalone Next.js application and documented its evidence,
  architecture, data-source, scoring, and regional-expansion rules.
- Proved exact LINZ address/parcel matching, official map layers, deterministic
  pool candidates, size comparison, feasibility scoring, and safe fallback
  explanations.
- Added initial reports, PDFs, manual property assessment, constrained pool
  placement, and Secure SDLC evidence for the internal Auckland POC.
