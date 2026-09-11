# LINZ address search index plan

**Status:** Draft for approval. This document plans the feature only. It does
not approve a database migration, LINZ import, scheduled job, deployment, or
production data write.

## Outcome

Make the Property Check address field feel like Google Maps while retaining
LINZ as the authoritative address source:

- address suggestions do **not** wait for a live LINZ request;
- selecting an address has an immediate visible result;
- the selected record keeps LINZ's stable `address_id`;
- legal parcel confirmation remains a separate, explicit official-data stage;
- an out-of-date or unavailable index never makes a property look confirmed.

The intended first experience is:

```text
Visitor types             -> local address results appear
Visitor chooses result    -> selected address and map shell appear
Property Check continues  -> LINZ parcel confirmation is shown as loading
Confirmed parcel returns  -> normal property-view workflow continues
```

## Scope decision

The module and schema are nationwide-capable. Before importing data, choose
one initial coverage level:

| Choice | Benefit | Trade-off |
| --- | --- | --- |
| **Auckland first (recommended)** | Smaller first import and quick proof for the current homeowner journey | Addresses outside Auckland continue to use the existing unavailable/region message |
| Nationwide | Matches the nationwide LINZ address contract immediately | Larger initial import, longer operational validation, and a broader support commitment |

No fallback to Google Places, Mapbox, or another commercial autocomplete
provider is planned. That would add a new paid processor and a second address
authority. LINZ remains the provenance of every result.

## Performance contract

These are user-facing targets, measured from the production route rather than
only from a local browser:

| Interaction | Target | Meaning |
| --- | --- | --- |
| Warm suggestion request, p50 | 100 ms or less | Results feel immediate after a typing pause |
| Warm suggestion request, p95 | 200 ms or less | Most real searches remain responsive |
| Address selection to address/map shell | 350 ms or less | The visitor sees progress without waiting for a LINZ address query |
| Parcel confirmation | Separate progress stage | It may take longer; it must not block the address-selection feedback |
| Index freshness | Successful sync within 8 days | LINZ address data is documented in this project as weekly-updated |

Serverless cold starts and a visitor's network can exceed these figures. The
page must still show a responsive loading state; they are not reasons to put a
live LINZ query back on every keystroke.

## Design

### The address-search module

Create one deep module at `src/modules/address-search/`. Callers know only its
small interface:

```ts
type AddressSuggestion = {
  addressId: string;
  fullAddress: string;
};

interface AddressSearch {
  search(query: string): Promise<AddressSuggestion[]>;
  getById(addressId: string): Promise<AddressMatch | null>;
  status(): Promise<{ indexedAt: Date; isFresh: boolean }>;
}
```

The implementation owns normalization, ranking, database SQL, active-address
filtering, result limits, index-freshness checks, and safe failure modes. The
existing route and Property Check flow do not know table names, search-index
details, or LINZ import mechanics.

The first adapter will be `NeonLinzAddressSearch`. An in-memory fake adapter
will support deterministic unit and UI tests. `OfficialGisGateway` remains the
adapter for live parcel and other official property layers; it is not called to
produce suggestions or re-resolve a selected address.

### Data held locally

Store only public address-search data from LINZ, in a new table separate from
homeowner assessments:

| Field | Purpose |
| --- | --- |
| `address_id` | Stable LINZ identity and primary key |
| `full_address` | Canonical result label |
| address number/unit/suffix | Exact unit and house-number ranking |
| road, suburb/locality, city, territorial authority, postcode | Search and coverage filtering |
| longitude, latitude | Trusted server-side map/property-start coordinates |
| `lifecycle` / `is_current` | Exclude retired records |
| LINZ source version or modified timestamp | Provenance and incremental sync |
| `synced_at` | Freshness/readiness status |

Do not store residents, ownership, visitor search queries, IP addresses, or
search history. The public route remains `POST` with `Cache-Control: no-store`;
the browser may keep a short-lived in-memory result map only for the current
page session.

### Search mechanics

1. Normalise exactly as the current address flow does: case, whitespace,
   punctuation, common New Zealand address notation, and postcode handling.
2. Rank exact unit/number plus road matches above road-only matches; preserve
   `42A` and `42` as distinct selectable records.
3. Return at most eight matches, with deterministic ordering.
4. Use database indexes suited to prefix/token matching. The migration spike
   will verify whether Neon permits `pg_trgm`; if not, use approved PostgreSQL
   prefix/token indexes and record the measured impact before implementation.
5. Resolve the selected `address_id` on the server from the index. Never trust
   browser-supplied coordinates.

## Delivery steps

| Step | How it will be achieved | Expected output | Test / gate |
| --- | --- | --- | --- |
| 1. Confirm scope and data contract | Approve Auckland-first or nationwide coverage, approved development database target, LINZ source method, and freshness policy | Signed-off coverage and safe field list | No data import before approval |
| 2. Prove source and load method | Run a read-only LINZ provider spike for pagination, lifecycle fields, source version/modified time, rate limits, and incremental-change support | Reproducible import design and fixture samples | Provider response, licence/attribution, and field-contract review |
| 3. Add schema | Add address table, import-run/checkpoint table, constraints, and measured search indexes through Drizzle migration | Generated migration and schema types | Migration applies to an explicitly approved development database; rollback documented |
| 4. Build importer | Add a resumable CLI importer that pages LINZ records, validates rows, upserts by `address_id`, records counts/checkpoint, and fails without partial silent success | Initial-load command plus import report | Fixture test, interrupted-run/resume test, duplicate/idempotency test, row-count reconciliation |
| 5. Add incremental sync | Use the verified LINZ change mechanism when available; otherwise use a bounded, documented refresh strategy. Run small deltas in a protected scheduled route only after initial load | Sync command/route and freshness record | Added/changed/retired record tests; stale-index and failed-sync tests |
| 6. Build address-search module | Implement the small interface and Neon adapter with bounded query/ranking/freshness logic | `AddressSearch` module and fake adapter | Unit tests for normalisation, ranking, units, postcode, max eight, and no-current-row leakage |
| 7. Cut over suggestions | Change `POST /api/public/address-suggestions` to the module; preserve rate limits, bounded JSON, correlation IDs, and no-store response headers | Fast local suggestion response | Route tests plus privacy/logging review |
| 8. Remove the second live address lookup | Update Property Check to load the selected LINZ address by ID from the module, immediately render the address stage, then perform parcel confirmation as its own progress stage | Instant selection feedback without a LINZ address round trip | Mouse, Enter-key, selection-change, unit/suffix, stale-ID, and parcel-failure UI tests |
| 9. Measure and tune | Record route durations and result counts without raw address text; test realistic indexed data volume in the approved development target | Performance evidence and dashboard/log fields | p50/p95 target run; explain any miss before rollout |
| 10. Controlled release | Review migration, source licence/attribution, privacy copy, cron configuration, rollback, and production performance before release | Go/no-go record | Production migration/deploy only with separate explicit approval |

## Import and sync model

### Initial import

The initial load is deliberately **not** a public Vercel request. It is a
resumable, authenticated operator command using the approved LINZ source and an
explicitly approved database URL. The command will:

1. create an import run with source/version and start time;
2. fetch bounded pages in a stable order;
3. validate required address fields and coordinates;
4. upsert rows by `address_id` in batches;
5. record checkpoint, accepted/rejected counts, and errors without raw visitor
   input;
6. mark the index ready only after reconciliation succeeds.

If it stops, the next run resumes from its checkpoint. A partial run is never
served as a ready index.

### Incremental refresh

After the provider spike proves the safe update mechanism, a protected sync
will update existing rows and mark retired addresses unavailable. It will run
more often than the freshness threshold, but work in bounded batches so it fits
the hosting runtime. A full re-index remains an operator-only recovery action,
not an automatic production cron job.

## Failure behaviour

| Condition | Visitor behaviour | Safety rule |
| --- | --- | --- |
| No matches | "No matching addresses found" | Do not invent a close address |
| Index unavailable | Clear retry message; no provider fan-out per keystroke | Do not bypass to unbounded live LINZ autocomplete |
| Index stale | Results may be labelled as temporarily unavailable or stale according to approved policy | Do not call a stale result "confirmed" |
| Selected record removed | Ask the visitor to search again | Do not use browser coordinates |
| LINZ parcel check slow/fails | Keep selected address visible and show `Needs Checking` / retry for the parcel stage | Address selection is not parcel confirmation |

## Expected output

When complete, the user-facing output is:

1. A visitor types `42A Bahari` and receives the exact current LINZ address in
   the suggestion list within the performance target.
2. The visitor selects it by mouse or keyboard; the page immediately shows the
   chosen address and begins the mapped property view.
3. The system retains the LINZ `address_id`, resolves map coordinates only on
   the server, and then confirms the legal parcel using the existing official
   parcel flow.
4. `42A Bahari Drive` and `42 Bahari Drive` remain distinct choices and never
   silently share identity.
5. Staff can see whether the index is ready and fresh, the latest successful
   sync time, counts, and safe error summaries - not visitors' typed addresses.

The engineering output is a versioned migration, importer, sync mechanism,
address-search module, updated public route/property selection flow, fixtures,
unit/route/browser/performance tests, and a release/rollback record.

## Approvals required before each write

| Action | Required approval |
| --- | --- |
| Create source fixtures from live LINZ | Confirm licensed source method and approved provider access |
| Apply migration or import addresses to development Neon | Exact development database target |
| Configure scheduled sync | Hosting target and credentials/configuration authority |
| Apply migration/import to production Neon | Exact production database target |
| Deploy or enable public cutover | Explicit release approval after evidence review |

## Not in this plan

- Google Places, Mapbox, or another commercial autocomplete provider.
- Parcel, title, aerial, flood, or feasibility-data replication.
- Storage of visitor address-search history.
- Automatic production migration, data load, scheduled-job configuration, or
  deployment.
