# Deployment and rollback runbook

This runbook describes the evidence required to promote PoolReady. It does not
authorise a deployment, database migration, credential change, real email test,
DNS change, or production-data access. Obtain approval for each target-changing
operation before performing it.

## 1. Freeze the candidate

1. Record the exact Git commit proposed for deployment.
2. Confirm the checkout is clean and the intended branch points at that commit.
3. Complete [`testing.md`](testing.md) from a clean checkout and retain the
   command output and security evidence.
4. Stop if any required gate fails, retries unexpectedly, or is tied to a
   different revision.

## 2. Review target configuration

Compare the approved Vercel environment with [`.env.example`](../.env.example)
without copying secret values into tickets, logs, screenshots, or this
repository. Confirm:

- Preview and Production select their intended, distinct database targets;
- LINZ and Auckland Council credentials are server-only;
- both Upstash REST values are present so deployed public routes fail closed;
- report signing, Resend sender identity, delivery mode, and preview sender are
  correct for the target;
- `SERVICEM8_FORWARD_EMAIL` remains unset until its privacy-retention gate
  passes;
- `CRON_SECRET` is present before enabling the retention schedule;
- analytics identifiers match the approved tools and remain consent-gated; and
- indexing remains disabled for test hostnames and is enabled only for the
  approved public hostname.

## 3. Prepare database changes

1. Identify the exact database host/name without printing credentials.
2. Review every SQL migration not yet applied and its data/locking impact.
3. Confirm a current backup or provider restore point and the person authorised
   to restore it.
4. Define the rollback for each migration. Prefer a forward repair when a
   reversal would discard captured assessment data.
5. Run `npm run db:migrate` only after target-specific approval, then verify the
   migration state and critical tables described in [`database.md`](database.md).

Address-index imports are separate mutating operations with their own production
guard. Do not infer permission from a deployment or migration approval.

## 4. Deploy and verify identity

Deploy only the frozen candidate. Before functional testing, prove that the
deployed revision matches the recorded commit. If Vercel reports a different
revision or environment, stop and correct the target rather than continuing
with mixed evidence.

## 5. Target smoke checks

Use synthetic, non-customer details approved for the target and verify:

1. The final hostname, TLS, security headers, host/origin handling, and indexing
   state are correct.
2. An Auckland address can be selected, the pool can be moved and rotated,
   detailed checks complete, and missing evidence remains **Needs checking**.
3. A report request persists once, renders its PDF, and reaches only the
   approved synthetic recipient and support destination without duplicate
   sends.
4. Contact and partnership enquiries return friendly validation and deliver
   only through the approved provider path.
5. Public rate limits produce managed allow and deny decisions before provider,
   database, PDF, or delivery work.
6. Anonymous Staff Workspace access is denied; Admin sign-in, lockout, expiry,
   sign-out, and saved-record access work.
7. Rejecting analytics consent leaves analytics unloaded and accepted events
   contain no address, contact, map, report, or staff data.
8. The retention endpoint rejects an invalid secret. Run a mutating retention
   job only with separate approval and records designed for that test.

Record request IDs and provider message IDs where useful, but do not retain
personal data, report contents, secrets, or raw provider payloads in release
evidence.

## 6. Rollback decision

Rollback when the deployed revision is wrong, a security boundary fails, public
traffic cannot be limited, persistent data is at risk, reports cannot be
delivered safely, or the core Property Check journey is unusable.

Application rollback:

1. Stop or divert public traffic if continued use can create unsafe writes or
   sends.
2. Promote the last known-good immutable deployment.
3. Confirm its revision and repeat the smallest safety-critical smoke set.

Database rollback:

1. Stop writes before changing schema or restoring data.
2. Follow the migration-specific rollback reviewed in step 3.
3. Do not drop columns, tables, or assessment records merely to make the old
   application start; preserve captured data and use a forward repair when
   safer.
4. Verify record counts, constraints, report retrieval, and delivery claims
   before reopening traffic.

Credential or provider failure:

1. Disable the affected feature or delivery path and stop retries that could
   duplicate sends.
2. Rotate a secret only through the approved secret store and account process.
3. Redeploy if the runtime requires it, then repeat the affected smoke checks.

## 7. Close the release

Update [`release-readiness.md`](release-readiness.md) or the approved external
release record with the deployed commit, environment, test results, known
warnings, migration/restore evidence, target smoke results, rollback owner, and
final PASS, FAIL, or BLOCKED decision. Repository code gates and target checks
must both pass before the deployment is called release-ready.
