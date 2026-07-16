# Soldato remediation — geomap-intial Job 01

- Date: 2026-07-16
- Scope: P1 findings from the blocked verification gate
- Status: implementation complete; security/review re-verification pending

## Red → green increments

1. **Verification artifact containment**
   - RED: the focused suite could not resolve the planned safe-path module.
   - GREEN: provider identifiers must be 1–20 digits, the output path is resolved
     under the configured directory, and path containment is asserted before the
     screenshot is written.
   - Regression: `../../outside` returns
     `VERIFICATION_ARTIFACT_ID_INVALID`.
2. **Streaming provider-response limit**
   - RED: the unknown-length response test showed all 20 chunks were consumed
     before `PROVIDER_RESPONSE_TOO_LARGE`.
   - GREEN: the gateway reads through a stream reader, cancels immediately after
     the configured byte limit, and never fully buffers the abusive response.
3. **Provider geometry limit**
   - RED: a parcel ring with 5,001 vertices was accepted.
   - GREEN: parcel rings are capped at 5,000 validated WGS84 positions and the
     same input returns `PROVIDER_RESPONSE_INVALID`.
4. **Production dependency advisory**
   - RED: production audit reported Next's bundled vulnerable PostCSS path.
   - GREEN: current stable Next `16.2.10` is retained and a global PostCSS
     `8.5.19` override produces a valid dependency tree, zero production audit
     findings, and a successful production build.
5. **Screenshot retention**
   - Generic `output/playwright` screenshots are ignored by Git.
   - Only the approved LINZ address `2359811` regression screenshot is eligible
     for repository retention; local arbitrary-address artifacts should be
     deleted after verification.

## Validation

- Focused data-access tests: 10 passed.
- Focused gateway tests: 3 passed.
- Full Vitest suite: 14 passed across 3 files.
- Strict TypeScript: passed.
- ESLint: passed.
- Prettier: passed.
- Next.js production build: passed with the PostCSS override.
- Live authenticated aerial verification: passed; exact 42A/42 separation and
  visible attribution preserved.
- Production dependency audit: 0 vulnerabilities.
- Secret/debug scan: 0 credential value hits and 0 debug instrumentation hits.

## Deliberate residual risk

The full audit reports four moderate development-only entries through stable
Drizzle Kit `0.31.10` and its legacy esbuild loader. The advisory concerns an
exposed esbuild development server; this project does not expose one through
Drizzle Kit. The current beta removes the chain, but a beta or npm's incompatible
downgrade is not adopted. Recheck the next stable Drizzle Kit release. Omertà
must independently decide whether this constrained, non-shipped risk is
acceptable.

No Job 02 UI, API, persistence, scoring, candidate, or PDF work was introduced.
