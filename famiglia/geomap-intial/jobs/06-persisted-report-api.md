# 06 — Persist and retrieve explainable reports

## Parent

`famiglia/geomap-intial/contract.md`

## What to build

Implement the PostgreSQL/Drizzle aggregate, safe analysis/retrieval routes, idempotent request lifecycle, and the complete interactive report page. Persist one immutable versioned assessment with queryable provenance, candidates, risks, and actions.

## Acceptance criteria

- [ ] Backward-compatible migration creates constrained/indexed report and child tables with rollback notes.
- [ ] Analysis writes the snapshot and explanation rows transactionally; failure cannot expose a partial complete report.
- [ ] Completed reports are immutable; reruns create new IDs/versions.
- [ ] POST analysis and GET report contracts validate input/ownership policy and return stable safe errors.
- [ ] Idempotency/duplicate handling prevents duplicate work while a request is active.
- [ ] Report page shows score/result/confidence, maps, scenarios, risks, recommendation, actions, missing data, sources, limitations, and attribution.
- [ ] Isolated database tests prove constraints, transaction rollback, snapshot/child consistency, and safe not-found behavior.
- [ ] No secret, raw provider error, or unnecessary personal data is stored/logged.
- [ ] Typecheck, lint, tests, migration checks, build, and real-route preview pass.

## Blocked by

Job 05.
