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

After the assessment response is returned, Next.js `after` starts delivery from the persisted
aggregate. Homeowner and ServiceM8 email destinations are claimed, attempted, and completed
independently. Each claim records its token, attempt count, timestamp, provider message ID, and
safe error code. A sent destination is never claimed again. Failed destinations and abandoned
five-minute-old `sending` claims may be retried by repeating the original idempotent submission.
Resend also receives a deterministic destination-specific `Idempotency-Key`, while the durable
database `sent` state prevents resends after Resend's provider-side idempotency window expires.

Report delivery needs these server-only settings:

- `RESEND_API_KEY`
- `REPORT_FROM_EMAIL`
- `SERVICEM8_FORWARD_EMAIL`

Missing delivery configuration records a delivery failure; it does not remove the saved assessment
or browser report. The ServiceM8 destination receives the same generated PDF attachment by email.
No ServiceM8 API job is created.

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
