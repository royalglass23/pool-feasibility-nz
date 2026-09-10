# Database design and current persistence

PoolReady uses PostgreSQL through Drizzle ORM with Neon as the initial
serverless provider. The database is now an implemented runtime dependency for
saved homeowner assessments, report-delivery state, retention records, the LINZ
address index, and Staff Admin sessions.

This replaces the original no-database POC assumption. The source of truth is
[`src/db/schema.ts`](../src/db/schema.ts) together with the ordered SQL files in
[`drizzle/`](../drizzle/). This document is an orientation guide, not migration
authority.

## Current tables

| Table                           | Purpose                                                                                                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `homeowner_assessments`         | Contact/consent fields, selected address evidence, pool layout, mapped layer states, warnings, recommendations, immutable report data, feasibility state, delivery/forwarding claims, timestamps, and archive state |
| `report_request_retention_runs` | Audit record for scheduled retention runs and their bounded deletion count                                                                                                                                          |
| `linz_address_index`            | Current public LINZ address-search records; it does not store visitor search history                                                                                                                                |
| `linz_address_index_runs`       | Import/reconciliation progress, source snapshot metadata, counts, and safe failure state                                                                                                                            |
| `staff_admin_accounts`          | Singleton Admin identity, salted password hash, failed-attempt count, and lockout state                                                                                                                             |
| `staff_sessions`                | Hashed Admin session tokens and expiry timestamps                                                                                                                                                                   |

Completed report data is stored as validated JSON snapshots plus indexed scalar
fields needed for identity, lifecycle, and operational queries. Report views,
PDFs, emails, and the Staff Workspace reuse the saved snapshot instead of
re-running live GIS analysis.

## Integrity and privacy rules

- Assessment references and idempotency keys are unique.
- Consent, visitor type, desired timing, feasibility state, lifecycle state, and
  delivery counters are constrained in the database.
- Email and forwarding claims make delivery retryable without deliberately
  sending duplicates.
- The address index stores LINZ source records, not a visitor's search history.
- Staff sessions store only a token hash and expire; password resets invalidate
  active sessions.
- Provider secrets, raw provider payloads, arbitrary headers, and internal
  errors do not belong in persisted report records.
- Retention and privacy deletion must use the documented bounded workflows.

## Spatial decision

PostGIS is deliberately not enabled. PoolReady analyses one bounded residential
parcel per assessment and stores validated WGS84 GeoJSON/report snapshots in
JSONB while Turf.js performs the bounded application-side geometry work.

Reconsider PostGIS only if national expansion requires database-side spatial
joins or indexes, reports must be searched by geometry, geometries become
materially larger, or measured application latency/memory justifies the extra
operational surface.

## Migration boundary

Generate and inspect migrations locally with:

```powershell
npm run db:generate
```

`npm run db:migrate` mutates the database selected by `DATABASE_URL`. Before
running it, identify the exact environment, inspect the pending SQL, confirm
backup/rollback expectations, and obtain the authority required for that target.
Never use a production database for local tests or preview deployments.

The production LINZ address-index commands use separate environment checks and
an explicit confirmation flag. Their safeguards reduce mistakes; they do not
grant permission to import or modify production data.

Related operating guides:

- [`staff-admin-access.md`](staff-admin-access.md)
- [`persistence-boundary.md`](persistence-boundary.md)
- [`privacy-request-handling.md`](privacy-request-handling.md)
- [`public-rate-limiting.md`](public-rate-limiting.md)
