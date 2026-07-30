# Retrofit gap report - MT-242

## P0 - release blockers

1. **Upgrade the vulnerable application boundary**
   - Upgrade Next.js from 16.2.10 to a non-vulnerable supported release (npm currently proposes
     16.2.12) and refresh both repository lockfiles intentionally.
   - Confirm the transitive `sharp` advisory is removed.
   - Rerun production audit, build, anonymous/wrong-credential/direct-route tests, and proxy-bypass
     regression coverage.
   - **Candidate status (2026-07-30):** Next.js and `eslint-config-next` are pinned to 16.2.12 in
     both lockfiles; focused tests, typecheck, lint, build, and local production proxy smoke pass.
     The production audit recheck remains blocked until dependency metadata may be sent to npm, so
     the historical transitive `sharp` result is not yet independently closed.

2. **Make the persisted assessment server-authenticated**
   - Do not accept address evidence, warning state, recommendations, report facts, consent version,
     or consent timestamp as authoritative browser assertions.
   - Persist from a short-lived signed/server-side assessment snapshot bound to the selected
     address, detailed evidence, pool layout/construction envelope, and map capture, or recompute
     the aggregate server-side.
   - Set consent version and received time on the server; reject altered, expired, replayed, or
     mismatched snapshots.

3. **Implement an explicit production access and abuse-control design**
   - Preserve the local development workflow, but add a reviewed homeowner/staff identity and
     authorization boundary before any deployment.
   - Add per-principal/IP rate limits and cost quotas for address, provider, assessment, PDF, and
     email work, plus a durable bounded delivery/render queue where needed.
   - Add CSRF/origin controls for ambient-credential mutations and safe uniform database errors.

4. **Close the personal-data lifecycle**
   - Replace the current consent copy with a notice covering persistence, homeowner email,
     ServiceM8 forwarding, processors/regions, purpose, retention, access/correction, and deletion.
   - Define a retention period and implement/test archive/delete, subject access, correction, and
     breach-scoping workflows.
   - Document Neon, Resend, and mail-processing locations and comparable NZ Privacy Act safeguards.

5. **Build strict isolated E2E infrastructure**
   - Provide a disposable database migration/seed/teardown path and fake email capture adapter.
   - Run a production build with dedicated anonymous/staff identities and no production/customer
     data.
   - Implement all 14 required rows in `e2e-matrix.md`, zero retries and one worker initially.

## P1 - required hardening

6. Add explicit CSP, frame-ancestor/X-Frame-Options, referrer, permissions, HSTS/TLS, and safe
   cache header evidence appropriate to the deployment.
7. Add privacy-safe audit events for authentication denials, validation/abuse rejections, staff
   reads, assessment creation, and delivery state changes; define alerting and retention.
8. Validate stored attribution URLs against an explicit HTTPS origin/scheme policy even though the
   PDF renderer currently blocks network requests.
9. Convert unexpected database/configuration failures on assessment routes to uniform safe error
   responses with correlation IDs and no development stack leakage.

## P2 - maintenance

10. Triage the 12 High and 6 Moderate full-tree audit findings. Production `next`/`sharp` fixes are
    P0; development-tool upgrades need compatible versions rather than npm's unsafe major
    downgrade suggestions.
11. Resolve the repository-wide formatter failures without rewriting unrelated mixed work in the
    same security remediation.
12. Bind future evidence to an immutable commit. The current candidate is a mixed uncommitted
    working tree, so its exact runtime state cannot support ready-for-merge PASS evidence.

## Required rerun

After remediation is implemented on an explicitly authorized branch or current branch, rerun the
full Secure SDLC pipeline against the exact immutable commit and new
`commit + configHash + fixtureVersion + environmentFingerprint + matrixHash` evidence key.
