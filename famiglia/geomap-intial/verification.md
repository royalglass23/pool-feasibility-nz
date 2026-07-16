# Verification — geomap-intial Job 01

- Date: 2026-07-16
- Scope: official data-access spike only
- Functional verdict: PASS
- Security verdict: PASS
- Review verdict: APPROVED
- Overall verification verdict: GREEN

## Test matrix

| Type                  | Applicability                                                                                 | Result         | Evidence                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------- |
| Unit                  | Provider-independent resolution, parcel, licensing, and containment decisions                 | PASS           | 14/14 Vitest tests across 3 files                                                     |
| Integration/runtime   | Real official-provider wiring                                                                 | PASS           | Retained live 42A and second-address/unit runs completed with zero provider errors    |
| Regression            | 42A/42, duplicate parcels, ambiguous parcels, unit/multi-title, response/geometry/path limits | PASS           | Controlled fixtures and deterministic negative tests                                  |
| CLI contract          | Required address, different address, and safe errors                                          | PASS           | No sample default; stable safe codes and explicit address argument                    |
| Real map verification | LINZ aerial, parcel boundary, address comparison, attribution                                 | PASS           | Authenticated tiles loaded; numeric and visual alignment passed                       |
| End-to-end product UI | Public address/report journey                                                                 | N/A            | Job 01 intentionally has no public report flow                                        |
| Security              | Boundaries, secrets, dependencies, retention                                                  | PASS           | `security/signoff.md` and `security/security-report.md`                               |
| Accessibility         | User-facing interface                                                                         | N/A            | Local verification artifact only; public UI belongs to Job 02                         |
| Performance           | Bounded external spike                                                                        | PASS for scope | Fixed parallel fan-out, response/feature/vertex limits, no public endpoint budget yet |

## Runtime proof

### Official GIS spike

```powershell
npm run spike:data-access -- "42A Bahari Drive, Ranui, Auckland"
```

- Resolved LINZ address `2359811` to parcel `8545868`, Lot 1 DP 576345.
- Kept `42 Bahari Drive` as address `969138` on distinct parcel `8545869`.
- Returned LINZ address, parcel, aerial, and building evidence as report-eligible.
- Returned successful Auckland Council observations as `spike_only`.
- Returned Watercare water/wastewater and culverts as unavailable.
- Returned zero provider errors in the retained successful live run.

### Different-address and unit proof

The same resolver/use-case path handles another supplied street address and the
real slash-unit example `2/49 Pigeon Mountain Road`. The unit's containing DCDB
parcel has multiple titles and is therefore labelled
`containing_parcel_requires_confirmation`, never confirmed as the unit boundary.

### Authenticated aerial verification

```powershell
npm run spike:verify-aerial -- "42A Bahari Drive, Ranui, Auckland"
```

- Selected address inside selected parcel: `true`.
- Comparison address inside selected parcel: `false`.
- Authenticated aerial tiles loaded: `true` at zoom 20.
- LINZ and imagery-contributor attribution visibly present.
- Retained image: `output/playwright/2359811-aerial-alignment.png`.

## Final validation commands

- `npm run typecheck` — PASS.
- `npm run lint` — PASS.
- `npm test -- --run` — PASS, 14 tests.
- `npm run format:check` — PASS.
- `npm run build` — PASS.
- `git diff --check` — PASS.
- Credential-value/hardcoded-secret scan — PASS, zero hits.
- Debug-instrumentation scan — PASS, zero hits.
- `npm audit --omit=dev --json` — PASS, zero vulnerabilities.
- Omertà retrofit sign-off — PASS.
- Enforcer three-axis review — APPROVED.

## Remaining external policy gates

1. Obtain or formally accept the Auckland Council generated-report/static-PDF
   reuse position before Council geometry becomes report evidence.
2. Keep Watercare assets and culverts unavailable unless an official automated
   endpoint and suitable reuse rights are proven.
3. Preserve explicit title/legal-boundary confirmation for unit, cross-lease,
   and multi-title properties.

These gates intentionally stop the complete report implementation. They do not
invalidate the verified internal Job 01 spike.
