# Release readiness — geomap-intial Job 01

- Date: 2026-07-16
- Release unit: bounded internal official data-access spike
- Branch: `feature/geomap-intial-data-access`
- Reviewed local base: `ddbf30b9dcaa2e6105fd185eb189c7441f0bdf5e`
- Readiness verdict: GO for internal checkpoint packaging and handoff
- Deployment verdict: NO-GO

## Decision

Job 01 is ready to be packaged as the repository checkpoint for the official
data-access spike. It proves a reusable Auckland address path, exact parcel
selection, real LINZ aerial alignment, bounded official-provider access, and
honest unavailable/licensing semantics. `42A Bahari Drive` remains a regression
fixture only; callers must supply the address to analyse.

This is not a deployable pool-feasibility product release. The current web route
is only the standalone scaffold. Candidate placement, scoring, confidence,
risks, report APIs, persistence, PDF generation, public rate limiting,
observability, and production operations belong to later jobs.

## Release evidence

| Area                       | Result | Evidence                                                                                            |
| -------------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| Functional verification    | PASS   | `verification.md`: 14/14 tests and retained live provider/map proofs                                |
| Security                   | PASS   | `security/signoff.md`: no High/Critical finding and zero production vulnerabilities                 |
| Architecture/specification | PASS   | `review.md`: Enforcer APPROVED with no actionable finding                                           |
| Validation gate            | GREEN  | `gate.md`: typecheck, lint, test, format, build, secret/debug, dependency, and scope checks pass    |
| Address generalisation     | PASS   | A different street address and a slash-unit address use the same resolver/use-case path             |
| Wrong-parcel prevention    | PASS   | 42A and 42 retain distinct LINZ address and parcel identifiers                                      |
| Data honesty               | PASS   | Council evidence remains `spike_only`; Watercare/culverts remain unavailable                        |
| RGtools independence       | PASS   | Repository scan found zero RGtools/Royal Glass Tools references outside internal workflow artifacts |

## Repository and publication state

- Repository root: `D:/Royal Glass Dev/geomap`.
- Origin: `https://github.com/royalglass23/pool-feasibility-nz`.
- The local feature branch and `main` both currently point to the original Create
  Next App commit before the uncommitted standalone scaffold and Job 01 changes.
- `git ls-remote` returned no `main` or feature-branch head from origin on
  2026-07-16; the remote appears not to contain either release branch yet.
- The complete Stage 1/Job 01 change set remains uncommitted in the working tree.
- No commit, push, pull request, merge, tag, deployment, or external mutation was
  performed by this release-readiness check.

Publication therefore requires a separately authorised, intentional commit and
push. The first remote publication should preserve the reviewed feature-branch
boundary rather than treating the current scaffold as a production launch.

## Configuration and secrets

- `.env` and `.env.local` are ignored; configured secret values have zero hits
  outside ignored environment files.
- The internal spike requires an explicit Auckland address. LINZ Basemaps aerial
  verification additionally requires `LINZ_BASEMAPS_API_KEY`.
- `LINZ_DATA_SERVICE_API_KEY` may remain server-side for future approved LDS use;
  Job 01's current address/parcel ArcGIS endpoints do not expose it.
- Database, Council, rate-limit, storage, and AI configuration is not required by
  the current internal CLI and must not be provisioned merely to publish this
  checkpoint.

## Data and migration impact

- No database schema, migration, repository, or persistent report table exists.
- No production or development database mutation occurs.
- Migration and data rollback are therefore N/A for Job 01.
- Drizzle configuration and the database proposal are scaffold/planning assets,
  not evidence of a deployed schema.

## Reversibility

Before publication, rollback is simply to leave the working tree unpublished.
After an authorised feature-branch commit, rollback consists of reverting that
checkpoint or deleting the unpublished feature branch; no database or external
data rollback is required. Do not rewrite or reset user work to perform rollback.

## Monitoring and operations

The internal CLI emits resolved identity, dataset availability, bounded feature
counts, provider durations, safe provider errors, and blockers. That is adequate
for the developer-run spike. It is not production observability. Correlation
IDs, structured service logs, metrics, alerts, rate limiting, retention, and a
provider-disable runbook remain mandatory before any public analysis endpoint.

## External policy gates

1. Auckland Council generated-report/static-PDF reuse must be accepted or
   confirmed before Council geometry becomes report evidence.
2. Watercare water/wastewater and culverts must remain unavailable unless an
   official automated endpoint and suitable reuse rights are proven.
3. Unit, cross-lease, and multi-title properties must retain explicit title and
   legal-boundary confirmation.

These gates do not prevent a LINZ-backed address/parcel/map prototype. They do
prevent treating Job 01 as approval to implement or launch the complete report.

## Handoff

The release-readiness review is complete. The next authorised action is either:

1. package and publish this reviewed Job 01 checkpoint on the feature branch; or
2. retain it locally and begin the separately approved Job 02 address/parcel/map
   tracer using only report-eligible LINZ evidence.

Neither action is inferred from this readiness verdict.
