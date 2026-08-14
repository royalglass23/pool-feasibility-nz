# Persisted assessment boundary

`POST /api/internal/assessments` is the development-only no-auth submission boundary for
MT-248. It is not safe for production or customer data until authentication, authorization,
rate limiting, CSRF protection, retention controls, and archive/delete workflows are added.

The request is validated into the report-ready aggregate before persistence. Only normalized
evidence references and validated GeoJSON are stored; raw provider responses, request headers,
provider secrets, and stack traces are not accepted by the persistence contract.

The `idempotencyKey` is required and unique. A retry returns the original assessment and stable
reference rather than creating a second record. Assessments start in `new_enquiry` and remain
retained until a later archive/delete workflow exists.

MT-249 adds the bounded PNG map capture needed to reproduce the saved browser report and PDF
without calling live GIS providers. New submissions require a validated PNG data URL. The database
column remains nullable only so pre-MT-249 development rows are not backfilled with a fictional
map; those legacy rows cannot enter report delivery.

After the assessment response is returned, Next.js `after` renders one PDF and sends independent
emails to the submitted homeowner and Royal Glass's internal lead inbox. Both messages include
that same PDF attachment, but neither send blocks the browser report. Each destination has its own
delivery claim, token, attempt count, timestamp, provider message ID, and safe error code. A sent
destination is never claimed again; failed and abandoned five-minute-old `sending` claims may be
retried by repeating the original idempotent submission. Resend receives a deterministic
`Idempotency-Key`, while the durable database `sent` state prevents resends after Resend's
provider-side idempotency window expires.

Report delivery needs these server-only settings:

- `RESEND_API_KEY`
- `REPORT_FROM_EMAIL`
- `REPORT_INTERNAL_EMAIL` (optional; defaults to `support@royalglass.co.nz`)
- `DATABASE_URL_DEV` for the dedicated Vercel Preview database when `DATABASE_URL` is Production-only

Missing delivery configuration records a delivery failure; it does not remove the saved assessment
or browser report. Public PDF downloads remain temporarily disabled, but the homeowner and Royal
Glass emails include the PDF attachment. `SERVICEM8_FORWARD_EMAIL` remains unset, and no ServiceM8
email or API job is created.
Saved-report access tokens derive a domain-scoped signing key from `RESEND_API_KEY` when
`INTERNAL_REPORT_SIGNING_SECRET` is not configured, so test delivery does not require an additional
Vercel variable. The separate `INTERNAL_REPORT_SIGNING_SECRET` remains the preferred key for signed
Property Check snapshots when that feature is enabled.

`GET /api/internal/assessments/:id/report` regenerates the PDF only from the saved aggregate and
map. It uses the same development-only internal access boundary as assessment submission.

Migration notes: apply `drizzle/0000_homeowner-assessments.sql` and any subsequent generated
Drizzle migrations in order. The forward migration creates the assessment table and reference
sequence. Before production use, the rollback plan is to stop writes, export retained records,
drop `homeowner_assessments`, then drop `homeowner_assessment_reference_seq` only after retention
approval.

MT-253 forward migration `drizzle/0003_curved_george_stacy.sql` adds a nullable visitor type,
nullable visitor-type and timing detail fields, and database checks for the supported values and
required `Other` details. The visitor type deliberately has no default so pre-MT-253 assessments
remain distinguishable as not captured. Before rolling this migration back, stop assessment
writes and export any rows that use the new fields. Remove the MT-253 detail and visitor-type
checks, migrate every `desired_timing = 'other'` row to an explicitly approved legacy value or
retain it outside the table, restore the previous timing check, and only then drop the three new
columns. Never discard captured visitor details as an implicit rollback step.

MT-258 adds a 12-month report-request retention boundary. A daily Vercel Cron GET calls
`/api/cron/report-request-retention` with the configured `CRON_SECRET` bearer token. The operation
calculates a calendar-accurate 12-month cutoff, deletes eligible `homeowner_assessments` rows, and
inserts one `report_request_retention_runs` audit row in one atomic PostgreSQL statement. Pending,
failed, sent, and abandoned delivery claims are eligible at the cutoff. A claim updated to `sending`
within the delivery system's five-minute active window is skipped, so retention cannot delete a row
while either email delivery is active; the next daily run handles it after the claim
finishes or becomes stale. A repeat run is safe and records a zero deletion count when nothing
remains eligible. The audit table contains only the run ID, run time, cutoff time, and deletion
count; it does not retain contact, address, layout, map, or report data.

The scheduled database operation covers the copy saved in Neon. Resend email data is a separate
linked processor copy. Production traffic must not be enabled until the provider-retention launch
gate in `docs/privacy-request-handling.md` has evidence that each enabled path meets the same
12-month requirement. See that runbook for the gate and for verified access, correction, and
early-deletion requests.
