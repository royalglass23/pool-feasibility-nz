# Enforcer review — geomap-intial Job 01

- Date: 2026-07-16
- Scope: current Job 01 working tree against `contract.md` and
  `jobs/01-official-data-access-spike.md`
- Verdict: APPROVED

## Ranked findings

### Must-fix

None.

### Should-fix

None.

### Nits

None.

The prior filesystem-path, streaming-response, geometry-size, screenshot-
retention, and production-dependency findings were re-reviewed against the
implemented remediation and are closed.

## Axis 1 — Architecture: PASS

- **Maintainability — keep.** `runDataAccessSpike` is the single deep use-case
  entry point (`src/modules/data-access-spike/run-data-access-spike.ts:162`). It
  owns normalization, parcel selection, evidence classification, and result
  assembly without exposing provider payloads to UI, scoring, or reporting code.
- **External seam — keep.** `DataAccessSpikeGateway`
  (`run-data-access-spike.ts:19`) is implemented by `OfficialGisGateway` and by
  controlled test gateways. Official URLs, query construction, timeouts,
  response limits, and provider parsing remain behind the adapter.
- **Decision/action separation — keep.** Parcel confidence
  (`run-data-access-spike.ts:366`), address/parcel alignment
  (`aerial-alignment.ts:15`), evidence-use gating, and verification-artifact
  containment (`verification-artifact.ts:5`) are deterministic and testable
  independently from live requests.
- **Scalability — keep for spike scope.** The use case is stateless, comparison
  addresses are capped at five (`run-data-access-spike.ts:216`), provider fan-out
  is fixed and parallel (`run-data-access-spike.ts:235`), feature/ring sizes are
  bounded, and the response reader stops at two megabytes by default.
- **Performance — keep for spike scope.** Independent dataset calls execute in
  parallel and the streaming reader enforces back-pressure before an unknown-
  length body can be fully buffered (`official-gis-gateway.ts:171`). Public
  latency budgets remain correctly deferred until a public analysis endpoint
  exists.

The deletion test passes: removing this module removes the entire bounded spike
capability without forcing provider-specific behavior into unrelated modules.

## Axis 2 — Family standards: PASS

- Early returns and explicit domain errors handle absent, ambiguous, outside-
  Auckland, unsafe, and unavailable cases.
- Business terms such as `ParcelMatch`, `DatasetObservation`,
  `reportEligibleDatasets`, and `containing_parcel_requires_confirmation` carry
  the decisions without provider or UI jargon leaking across boundaries.
- All external access is behind the gateway adapter and fixed dataset catalogue;
  provider origins are allow-listed (`official-gis-gateway.ts:15`).
- Zod validates address and parcel payloads, coordinate ranges, feature counts,
  ring counts, and ring vertices before Turf or output code consumes them
  (`run-data-access-spike.ts:108-160`).
- Provider errors crossing the use-case/CLI boundary are stable and safe. No raw
  credential-bearing error is returned.
- Strong TypeScript types cover positions, dataset keys, evidence-use states,
  parcel confidence, and result shape. No unbounded `any` or unchecked provider
  cast crosses the adapter boundary.
- Focused regressions prove containment, stream cancellation, oversized geometry,
  wrong-parcel prevention, unit/multi-title caution, and licensing segregation.

## Axis 3 — Specification: PASS

| Job 01 acceptance requirement                                | Evidence                                                                                                                                                                         |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Distinguish 42A from 42/parent/neighbours                    | Controlled regression and live evidence identify address `2359811`/parcel `8545868` separately from address `969138`/parcel `8545869`; `tests/unit/data-access-spike.test.ts:31` |
| Support different supplied Auckland addresses                | Same use case resolves `42 Bahari Drive`; a slash-unit fixture and live unit run use the same adapter path; `tests/unit/data-access-spike.test.ts:91,113`                        |
| Align address, parcel, and real aerial                       | Deterministic point-in-polygon test plus retained authenticated LINZ map evidence; `evidence/42a-aerial-alignment.md`                                                            |
| Record official source and licence findings                  | All 17 requested dataset categories are registered in `docs/data-sources.md` with the required metadata and limitations                                                          |
| Treat Watercare honestly                                     | Water/wastewater remain explicit `unavailable`; no endpoint is called and no asset is inferred; `run-data-access-spike.ts:488`                                                   |
| Output source availability, counts, latency, and safe errors | `DataAccessSpikeResult` exposes all required bounded spike fields; provider failure regression proves redaction                                                                  |
| Avoid fictional data                                         | Product output uses live official calls; controlled LINZ fixtures are tests only; unavailable sources remain unavailable                                                         |
| Stop later implementation at critical data gates             | Council evidence is code-gated to `spike_only`; report/PDF implementation remains stopped pending reuse review                                                                   |

No Job 02 UI, public API, scoring, candidate placement, persistence, report, or
PDF behavior was smuggled into this slice.

## Accepted non-blocking watch items

- Auckland Council generated-report/static-PDF reuse remains conditional. This
  blocks promotion of Council observations into report evidence, not approval of
  the internal Job 01 spike.
- Watercare water/wastewater and a dedicated culvert layer remain unavailable.
  Later confidence and action logic must preserve that uncertainty.
- Four moderate advisories remain in Drizzle Kit's development-only legacy
  loader. Omertà accepted the non-shipped exposure as a watch item; production
  audit is clean and the next stable Drizzle Kit release must be rechecked.

## Outcome

All three Enforcer axes pass. Job 01 is APPROVED for the validation gate.
