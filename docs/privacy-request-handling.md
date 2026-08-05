# Privacy request handling

This is the manual process for the single Royal Glass Admin/support operator handling access,
correction, or early-deletion requests for preliminary report requests. The public channel is
`support@royalglass.co.nz`. Do not ask a visitor to create an account.

The New Zealand Office of the Privacy Commissioner says people can ask an organisation for access
to their personal information and to correct information that is wrong, incomplete, or misleading.
Access and correction requests usually require a response within 20 working days. Principle 9 also
requires personal information not to be kept longer than needed for its lawful purpose.

- [Privacy rights and response timing](https://www.privacy.org.nz/your-rights/your-privacy-rights/)
- [Correction of personal information](https://www.privacy.org.nz/privacy-principles/7/)
- [Retention of personal information](https://www.privacy.org.nz/privacy-principles/9/)

## 1. Receive and classify the request

1. Record a support case ID, received date, request type, due date, and assigned Admin.
2. Do not copy the visitor's contact or property details into an extra tracking system.
3. Treat a request as a privacy request even when it does not mention the Privacy Act.
4. Preserve the original request while it is being handled, then apply the support-mailbox retention
   policy after closure.

## 2. Verify the requester

1. Ask for the preliminary report reference and the email address used for the request.
2. Find the request in the protected Staff Workspace and compare those details.
3. Reply to the email address already saved on the report request to confirm control of that address.
4. If someone acts for the visitor, obtain written authority from the visitor before disclosing or
   changing anything.
5. Request additional identity evidence only when the above checks are insufficient. Do not keep a
   copy after verification unless a documented lawful reason requires it.

Never disclose whether a different person's report request exists.

## 3. Locate the exact record

Use the protected Staff Workspace to locate the record by report reference. Confirm the saved email
address and checked property address before acting. If a database operation is required, use the
record's immutable database ID as the mutation target and run the operation against the explicitly
authorised environment only.

Do not search or mutate production data through a general development connection string. Use a
transaction and verify that exactly one intended record is affected before committing an update or
early deletion.

## 4. Complete the requested action

### Access

Provide the visitor with a secure copy of the information held about their request: saved contact and
visitor context, checked property information, submitted pool layout, report, and relevant delivery
status. Exclude secrets, internal security data, other visitors' information, and raw provider
payloads. Record the response date against the support case ID.

### Correction

Record the correction requested. Correct only the verified visitor's record and only the fields that
are inaccurate, incomplete, or misleading. Recheck the protected Staff Workspace after the change.
If Royal Glass does not make the requested correction, explain why and attach the visitor's statement
of correction to the retained case material as required by the Privacy Act process.

If corrected information was disclosed to ServiceM8, take reasonable steps to correct it there as
well and record that processor action against the support case ID.

### Early deletion

Confirm that no documented legal or dispute-related hold requires temporary retention. Then:

1. Delete the exact `homeowner_assessments` row in a transaction and confirm that exactly one row was
   deleted.
2. If the saved delivery state shows that ServiceM8 forwarding completed and the message remains an
   unconverted Inbox item, remove it through the authorised ServiceM8 Admin process. If it was
   converted to or attached to a job, escalate to the ServiceM8 privacy/support process: ServiceM8
   documents job email/SMS entries as communication records that cannot be deleted through the
   normal Job Diary removal flow.
3. If provider-held email content or delivery data also needs deletion, use the authorised Resend
   privacy/support process and record completion against the support case ID.
4. Do not put the deleted report reference, contact details, address, layout, map, or report into a
   deletion log.

The normal scheduled process deletes saved report requests automatically at 12 months. Its durable
audit contains only a run ID, run time, cutoff time, and deletion count.

## 5. Provider-retention launch gate

The automatic database job deletes the Royal Glass copy in Neon. It does not delete sent email data
from Resend or a notification received by ServiceM8. Before enabling either delivery path for
production traffic, the Royal Glass privacy owner must capture current evidence that the enabled
provider path deletes or irreversibly de-identifies linked report-request data no later than 12
months.

For each enabled provider, keep a non-PII control record with the provider name, Royal Glass account
or team identifier, effective retention period, configuration or contract reference, verification
date, and reviewer. Store screenshots or contract extracts in the restricted compliance location,
not in this repository. Recheck the evidence after provider-plan or account-setting changes and at
least annually. If a provider path cannot meet the 12-month limit, do not enable that path for
production report requests; escalate the integration design instead of relying on a manual bulk
cleanup after the Neon row has gone.

Useful provider facts to verify against the actual Royal Glass accounts:

- [Resend's retention documentation](https://resend.com/docs/dashboard/webhooks/how-to-store-webhooks-data)
  says it retains email data for 30 days across all plans, with flexible retention available for
  Enterprise.
- [ServiceM8's Inbox documentation](https://support.servicem8.com/hc/en-us/articles/360000471135-What-is-the-ServiceM8-Inbox)
  says Inbox messages can be removed, but converted messages and attachments are saved to the job
  diary.
- [ServiceM8's Job Diary deletion guidance](https://support.servicem8.com/help-center/desktop/faq/how-to-delete-notes-photos-and-other-attachments-from-the-job-diary)
  says job email/SMS communication records cannot be deleted through the normal removal process.
- [ServiceM8's Inbox API](https://developer.servicem8.com/reference/archiveinboxmessage) exposes
  archive/unarchive, not an irreversible deletion operation.

This evidence is a deployment prerequisite, not proof supplied by the application tests or the
generated migration.

### Verification record: 2026-08-05

- **Resend — passes the 12-month gate.** The signed-in Royal Glass Resend team showed the Free
  transactional plan. Resend's current official retention documentation states a 30-day email-data
  period across all plans. Recheck this evidence if the account plan or provider policy changes.
- **ServiceM8 forwarding — disabled pending evidence or redesign.** The signed-in Royal Glass
  ServiceM8 account showed that its configured forwarding address feeds the ServiceM8 Email Inbox.
  Official documentation supports removing an unconverted Inbox message, but the public API only
  exposes archiving and a converted/attached message becomes a non-deletable job communication
  record. This does not prove automatic irreversible deletion within 12 months.
- **Current Vercel project — delivery and cron are not enabled.** A read-only review of the
  `pool-feasibility` project variable names found no `RESEND_API_KEY`, `REPORT_FROM_EMAIL`,
  `SERVICEM8_FORWARD_EMAIL`, or `CRON_SECRET`. Keep `SERVICEM8_FORWARD_EMAIL` absent until its gate
  passes. Add the delivery and cron variables only through the separately authorised deployment
  workflow, then re-verify this record.

## 6. Close safely

1. Tell the requester what was provided, corrected, or deleted, including any lawful limitation.
2. Record only the support case ID, action type, completion date, Admin, and processor actions needed
   for an operational audit.
3. Remove temporary exports and identity-check material from local devices and shared folders.
4. Escalate suspected unauthorised disclosure or loss through the Royal Glass privacy-breach process.

This runbook does not authorise a production database connection, migration, bulk deletion, or
processor account access. Those targets and credentials must be verified separately before use.
