# 02 — Deliver the address-to-parcel map tracer

## Parent

`famiglia/geomap-intial/contract.md`

## What to build

Deliver the first end-to-end user journey: validate an Auckland address, present ambiguous matches, confirm the correct legal parcel, and display an attributed real aerial with the verified parcel. Include loading/error/disabled states and fixture-backed API/browser tests.

## Acceptance criteria

- [ ] Home input supports optional preferred location and size, Auckland notice, limitations, progress, and duplicate prevention.
- [ ] Ambiguous, not found, outside-region, and parcel-not-found outcomes use stable safe errors.
- [ ] Unit/rear-lot/subdivision matching never silently falls back to a parent parcel.
- [ ] The proof address regression distinguishes `42A` from `42`.
- [ ] Real imagery, parcel, scale/north/attribution display through a credential-safe approach proven in Job 01.
- [ ] Keyboard, focus, label, error-association, responsive, and automated accessibility checks pass.
- [ ] Controlled provider fixtures cover the API and browser seam.
- [ ] Typecheck, lint, tests, build, and real-route preview pass.

## Blocked by

Job 01.
