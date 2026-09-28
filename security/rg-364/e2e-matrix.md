# E2E matrix — RG-364

| Requirement | Evidence | Result |
|---|---|---|
| Homeowner and builder saved reports | `homeowner-report.spec.ts` | PASS |
| Address, pool selection, move/edit/invalidation, custom input | `fast-property-view.spec.ts`, `pool-rotation.spec.ts` | PASS |
| Builder keyboard details and route adjustment | `builder-details-accessibility.spec.ts`, `access-route-adjustment.spec.ts` | PASS |
| Failure, retry, signed-session separation | `data-access-inspector.spec.ts`, `fast-pool-warning.spec.ts` | PASS |
| Persistence, audience equivalence, cleanup | `constructability-persistence.spec.ts` | PASS |
| Staff authentication and read-only reproduction | `staff-assessments.spec.ts` | PASS |
| Map worker/runtime graph | `maplibre-worker.spec.ts` | PASS |
| Mobile and 200% visual checkpoints | nine local screenshots under `tmp/rg-364-visual-evidence` | PASS by inspection |
| Screen-reader semantics and focus | unit focus regression plus keyboard E2E | PASS |
| Public input and authorization abuse cases | `input-security.spec.ts` in database-disabled and development-database modes | PASS |
