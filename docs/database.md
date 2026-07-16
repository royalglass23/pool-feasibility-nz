# Database proposal

## Provider and spatial decision

Use PostgreSQL through Drizzle ORM and a Vercel-compatible serverless provider; Neon is the initial driver baseline. Use UUID primary keys, `jsonb` for validated GeoJSON/evidence snapshots, and scalar columns for filtering and auditability.

Do not enable PostGIS in the POC. The workload analyses one bounded residential parcel per report and does not require database-side spatial search. Reconsider PostGIS when national expansion requires parcel-scale joins in SQL, spatial indexes across reports, large raster/vector processing, or measured application memory/latency exceeds its budget.

## Proposed tables

### `feasibility_reports`

| Column                       | Type                      | Notes                                                       |
| ---------------------------- | ------------------------- | ----------------------------------------------------------- |
| `id`                         | uuid PK                   | Public report identifier, unguessable                       |
| `requested_address`          | text                      | Minimise retention; redact in logs                          |
| `resolved_address`           | text nullable             | Official normalized result                                  |
| `latitude`, `longitude`      | double precision nullable | Resolved address point                                      |
| `parcel_identifier`          | text nullable             | Official stable identifier                                  |
| `parcel_geometry`            | jsonb nullable            | Validated GeoJSON only                                      |
| `status`                     | text/check                | `pending`, `complete`, `failed`                             |
| `score`                      | smallint nullable/check   | 0–100, independent of confidence                            |
| `rating`                     | text nullable             | Deterministic band                                          |
| `confidence`                 | text nullable/check       | `high`, `medium`, `low`                                     |
| `summary`                    | text nullable             | Deterministic fallback text or validated optional narrative |
| `main_recommendation`        | text nullable             | Structured recommendation category/text                     |
| `input`                      | jsonb                     | Validated preferred location/size and request metadata      |
| `assessment_snapshot`        | jsonb nullable            | Immutable versioned report model used for rendering         |
| `failure_code`               | text nullable             | Safe application error code only                            |
| `pdf_storage_reference`      | text nullable             | Opaque storage key, never arbitrary URL                     |
| `analysis_version`           | text                      | Rules/provider contract version                             |
| `generated_at`, `updated_at` | timestamptz               | UTC timestamps                                              |

### `dataset_results`

One row per report/dataset call: provider, dataset, dataset identifier, official metadata reference, licence, attribution, retrieval/dataset timestamps, availability status, feature count, confidence, bounded duration, safe error code, attributes used, and optional validated geometry/evidence JSONB. Raw provider payloads are not stored by default.

### `candidate_zones`

One row per ranked scenario candidate: scenario, rank, result status, rotation, pool dimensions, construction-envelope configuration, candidate geometry, affected percentages, distance summaries, score components, confidence, and evidence references.

### `feasibility_risks`

Category, title, severity, evidence, source dataset reference, confidence, potential impact, action, specialist-review flag, and display order.

### `recommended_actions`

Phase (`before_concept_design`, `before_quotations`, `before_consent_or_construction`), priority, title, reason, source/flag references, and completion-independent display order.

## Integrity and lifecycle

- Child tables use report foreign keys with cascade delete.
- Score bounds, enum-like values, ranks, and non-negative counts receive database checks.
- Index report status/date, parcel identifier, and every child report foreign key.
- Save the completed assessment and child explanation rows in one transaction.
- Treat completed reports as immutable snapshots; a rerun creates a new report ID and analysis version.
- Do not persist provider secrets, raw internal errors, unnecessary request headers, or unrelated personal information.
- Define retention and deletion policy before production launch.
- Migrations require forward and rollback notes; schema implementation starts only after Stage 1 approval.

The JSONB snapshot is the reproducible render source. Queryable child rows explain the score and provide operational visibility. Repository tests must prove the two representations are written from the same aggregate in a single transaction.
