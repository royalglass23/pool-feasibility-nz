# Retrofit gap report - expandable-assessment-pdf

## P0 - security/release blockers

1. **Reject active/fake map payloads and isolate Chromium**
   - Deep-decode PNG base64; verify signature, decoded size, and dimensions.
   - Escape the image attribute even after validation.
   - Abort all renderer network requests and add a regression probe.
   - Covers F-01, OWASP A03/A10, ASVS V5/V12.

2. **Make the report snapshot server-verifiable**
   - Choose and document one approach: immutable short-lived server snapshot, signed canonical report view model plus trusted map binding, or server-side static map generation from the same verified evidence.
   - Reject any modified address, score, recommendation, evidence-use classification, limitations, or map association.
   - Covers F-02 and F-05 integrity aspects, OWASP A08.

3. **Replace shallow checks with a strict bounded schema**
   - Bound every string/array/object/number/date/enum and reject unknown keys.
   - Validate total decoded map bytes independently of JSON character count.
   - Covers F-03, OWASP A03/A04, ASVS V5/V13.

4. **Bound PDF resource usage**
   - Add concurrency semaphore/pool, bounded queue or 429 busy response, render timeout, forced browser cleanup, and per-principal/IP throttling.
   - Covers F-04, OWASP A04, ASVS V11/V13.

5. **Enforce report-eligible evidence and printable attribution**
   - Exclude `spike_only`, `internal_reference`, and `unavailable` geometry/content from the generated PDF unless separately approved.
   - Render attribution/licence/evidence-use text outside the WebGL canvas; test the exact print model.
   - Covers F-05 and the current legal/source release gate.

## P1 - required hardening

6. Add structured outcome-only PDF security logging and alertable busy/timeout/rejection categories without residential data.
7. Add identity-aware deployment access, TLS, rate limiting/lockout, and standard security headers before any deployment.
8. Add a user-facing privacy/collection notice and operational breach/access/correction process before handling customer-linked data.

## P2 - maintenance

9. Review the seven moderate development-tool advisories; upgrade/remove unused `drizzle-kit`/`shadcn` paths without unsafe downgrade.
10. Reconcile `docs/report-format.md` with the actual session-only renderer and record the production runtime decision only after a deployment spike.

## Required rerun

After remediation is committed, rerun the same matrix with a new commit/config/matrix/fixture/environment evidence key, zero retries, one worker, production build, and validator. A diagnostic pass on an uncommitted working tree is not merge evidence.
