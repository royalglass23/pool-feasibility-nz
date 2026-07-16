# Shakedown: Job 01 official data-access spike

## Outcome

The bounded internal CLI and its provider seam are implemented. Exact address,
legal-parcel identity, and authenticated real-aerial alignment passed. Council
layers remain excluded from report evidence pending reuse review; no unavailable
data is fabricated or silently substituted.

## Public behavior covered

- Exact full-address selection from multiple LINZ candidates.
- A different supplied address and a real slash-unit address use the same public
  resolver and parcel-matching path.
- `42A` and `42` retained as separate alternatives with distinct address IDs.
- Legal parcel selected by address-point intersection.
- Duplicate LINZ parcel rows removed by stable parcel ID.
- Multiple distinct containing parcels fail closed with `PARCEL_AMBIGUOUS`.
- Dataset calls use a fixed catalogue and bounded parcel envelope.
- Missing Basemaps key returns explicit `unavailable` without calling the provider.
- A configured Basemaps key loads authenticated real aerial tiles for a supplied
  address without persisting or returning the credential.
- Numeric alignment verifies the selected address is inside the selected parcel
  and comparison-address points are outside it.
- Watercare water/wastewater are explicit `unavailable`; no request or inference.
- Individual dataset request failures are recorded with a safe code and do not
  expose a credential-bearing provider message.
- Live output contains the resolved address, coordinates, legal parcel polygon,
  comparison parcel, dataset counts, timing, unavailable sources and blockers.

## Security and reliability checks

- Zod validates address/parcel provider responses and bounds feature/ring counts.
- Geographic positions are range checked.
- Provider origins are allow-listed; no arbitrary proxy URL is accepted.
- Provider requests have a configurable timeout and a two-megabyte response cap.
- Basemaps credentials are read server-side by the CLI and are never returned.
- Safe error codes cross the use-case boundary; raw internal errors do not.
- Runtime abort/timeout exceptions are normalised to `PROVIDER_TIMEOUT`.
- The CLI has no sample-property default and returns `ADDRESS_REQUIRED` when the
  caller omits the address.
- Unit or multi-title containing parcels are explicitly marked
  `containing_parcel_requires_confirmation` rather than confirmed.
- Technically successful Council calls are labelled `spike_only` and excluded
  from `reportEligibleDatasets` until reuse permission is resolved.
- No secrets, Watercare data or Auckland Council response fixtures were stored.
- LINZ fixtures are bounded extracts from CC BY 4.0 datasets and are documented.

## Validation evidence

| Check                                  | Result                                     |
| -------------------------------------- | ------------------------------------------ |
| Focused red test before implementation | failed on missing spike module as expected |
| Focused Vitest suite                   | address and adapter regressions passed     |
| Full Vitest suite                      | 14 passed across 3 files                   |
| TypeScript strict check                | passed                                     |
| ESLint                                 | passed                                     |
| Prettier check                         | passed                                     |
| Next.js production build               | passed                                     |
| Live official-provider run             | passed with 0 provider errors              |
| Live second-address/unit run           | passed with 0 provider errors on retry     |
| Authenticated aerial verification      | passed; real tiles and attribution visible |
| Aerial visual inspection               | passed; parcel and address markers align   |
| Credential text scan                   | 0 key-value hits outside ignored `.env`    |
| `git diff --check`                     | passed                                     |

The first attempt to run Vitest concurrently with typecheck, lint, and Prettier
timed out while starting Windows worker processes; no test assertion ran. The
suite was immediately rerun by itself and all 11 tests passed.

## Security remediation pass

- Unsafe provider identifiers are rejected before an aerial screenshot path is
  created, and resolved-path containment is enforced.
- Unknown-length provider bodies are stopped and cancelled while streaming once
  they cross the configured response limit.
- Parcel rings exceeding 5,000 vertices fail provider-response validation.
- Generic address screenshots are ignored by Git; only the approved fixture is
  retainable.
- Stable Next `16.2.10` builds successfully with patched PostCSS `8.5.19`, and
  the production dependency audit reports zero vulnerabilities.
- Four moderate Drizzle Kit/esbuild entries remain development-only and require
  independent Omertà risk acceptance or a future stable upstream fix.
- The post-remediation full suite passed 14 tests; the earlier 11-test result
  remains the pre-remediation checkpoint described above.

## Deliberately skipped or blocked

- No Auckland Council geometry is promoted into report fixtures or product
  findings: generated commercial-report reuse remains conditional pending review.
- No Watercare automation: the published CC BY-NC-ND licence is unsuitable for
  this proposed commercial generated-report use without permission.
- No complete Unitary Plan overlay catalogue: the spike proved one representative
  official overlay endpoint only.
- No candidate pools, feasibility score, report UI, persistence, API or PDF: all
  belong to later jobs and are prohibited until the data gates are reviewed.
- No Playwright flow: this slice intentionally exposes an internal CLI, not a UI.
- No rate limiter: this is a developer-run bounded CLI; public API rate limiting
  belongs to the later report endpoint slice.

## Required review before resuming

1. Confirm Auckland Council's permission/attribution position for automated
   generated reports, static PDFs and the intended commercial use.
2. Accept Watercare water/wastewater and unverified culvert data as unavailable,
   or obtain suitable authorised access and reuse rights.
3. Keep unit, cross-lease and multi-title addresses behind an explicit title and
   legal-boundary confirmation gate in the later public resolver.
