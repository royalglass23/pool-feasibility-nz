# Job: geomap-intial

- Mode: full
- Entry: idea
- Current phase: release
- Status: handoff-ready
- Repository contract: `AGENTS.md`, `CLAUDE.md`, and the explicit user brief
- Artifact root: `famiglia/geomap-intial/`
- Issue/contract: `famiglia/geomap-intial/contract.md`
- Approval boundary: Job 01 official data-access spike only; no report feature, schema deployment, push, merge, or deployment
- Base/target branch: `main` -> `feature/geomap-intial-data-access`; GitHub origin configured, no remote `main` or feature head observed, and no protected-branch policy inspected
- Worktree: repository root
- Issue tracker: none configured; slices are local Markdown artifacts

## Pipeline

| Stage               | Skill                       | Status | Artifact or evidence                                                        |
| ------------------- | --------------------------- | ------ | --------------------------------------------------------------------------- |
| Repository contract | Godfather                   | done   | Empty standalone workspace verified; generated `AGENTS.md`/`CLAUDE.md` read |
| Scout uncertainty   | Rat principle inline        | done   | No existing code to scout; external-data uncertainty is isolated as Job 01  |
| Specify             | Sit-down synthesis          | done   | `contract.md`; brief was sufficiently detailed, so no redundant interview   |
| Quality route       | Godfather                   | done   | Required tracks below                                                       |
| Slice vertically    | Capo                        | done   | Eight approved jobs under `jobs/`                                           |
| Approval gate       | Godfather                   | done   | User invoked full execute phase on 2026-07-16                               |
| Execute             | Soldato                     | done   | Job 01 implementation plus P1 security remediation passed full validation   |
| Verify              | Testing / Omerta / Enforcer | done   | Functional PASS, Omertà PASS, Enforcer APPROVED, final gate GREEN           |
| Release             | Release readiness           | done   | Internal checkpoint GO; deployment NO-GO; `release-readiness.md`            |

## Quality routing

| Track                        | Route    | Reason / planned evidence                                                                     |
| ---------------------------- | -------- | --------------------------------------------------------------------------------------------- |
| API and interface contracts  | required | Three public routes, provider ports, explicit errors, timeout/partial-failure semantics       |
| UI and accessibility         | required | Address flow, progress, ambiguity, report/map/PDF states; keyboard/semantics/scan             |
| Data and migrations          | required | Five-table PostgreSQL proposal, transactions, retention, rollback                             |
| External systems             | required | Official GIS, PostgreSQL, aerial tiles, optional storage/rate limit/AI                        |
| Performance                  | required | Provider fan-out, spatial placement, map bundle, PDF cold start; budgets set before execution |
| Operations and observability | required | Correlated structured logs, provider latency/availability, score explanation, PDF signals     |

## Assumptions to approve

1. The empty workspace root is the repository even though its parent folder name differs from the temporary product name; package/product identity is `pool-feasibility-nz`.
2. A modular monolith on Vercel is the POC deployment unit.
3. Neon/PostgreSQL plus application-side Turf analysis is sufficient until measured evidence justifies PostGIS.
4. Completed reports are immutable, versioned snapshots; reruns create a new report ID.
5. Stage 2 may conclude that some non-core datasets are unavailable, provided confidence/actions remain honest; exact address/parcel and reusable aerial/parcel access are core gates.

## Current findings and blockers

- `42A` identity is proven as LINZ address `2359811`, parcel `8545868`, Lot 1 DP 576345; `42` is distinct parcel `8545869`.
- A second live unit address resolved through the same path. Its containing `DCDB` parcel has multiple titles, so the result is explicitly gated as requiring title/unit-boundary confirmation.
- Authenticated LINZ aerial imagery rendered successfully. The selected address point is inside parcel `8545868`; the `42 Bahari Drive` comparison point is outside it. Attribution is visible in the retained screenshot.
- Auckland Council property-specific API access works, but automated generated-report/static-PDF reuse is conditional pending terms review or written permission.
- Watercare automation was not adopted: the published CC BY-NC-ND licence does not establish suitable commercial generated-report reuse. Water/wastewater remain unavailable and unverified.
- No dedicated official culvert endpoint or verified asset mapping was established.
- Production dependency audit is clean after a patched PostCSS override. Four moderate Drizzle Kit/esbuild findings remain development-only; no exposed esbuild development server exists in this project, and the next stable upstream release must be rechecked.
- The full Omertà retrofit rerun passes. Enforcer independently approved the remediated slice and the final validation gate is GREEN.

## Execute evidence

- `famiglia/geomap-intial/scout-report.md`
- `famiglia/geomap-intial/evidence/42a-bahari-drive-spike.md`
- `famiglia/geomap-intial/evidence/second-address-generalisation.md`
- `famiglia/geomap-intial/evidence/licensing-gate-refresh.md`
- `famiglia/geomap-intial/evidence/42a-aerial-alignment.md`
- `famiglia/geomap-intial/shakedown.md`
- `famiglia/geomap-intial/remediation.md`
- `famiglia/geomap-intial/verification.md`
- `famiglia/geomap-intial/security/signoff.md`
- `famiglia/geomap-intial/security/security-report.md`
- `famiglia/geomap-intial/security/gap-report.md`
- `famiglia/geomap-intial/review.md`
- `famiglia/geomap-intial/gate.md`
- `famiglia/geomap-intial/release-readiness.md`
- `docs/data-sources.md`
- Final verification on 2026-07-16 passed: 14 Vitest tests, strict typecheck, ESLint, Prettier, production build, retained live authenticated aerial verification, zero production audit findings, `git diff --check`, and credential/debug scans. Independent Omertà security re-verification is PASS; Enforcer is APPROVED and the gate is GREEN.
- Release readiness on 2026-07-16 is GO for packaging/handoff of the bounded internal Job 01 checkpoint and NO-GO for deployment or public product launch. The change set remains uncommitted and unpublished.
