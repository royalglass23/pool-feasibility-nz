# Threat model - saved report download and delivery

## Data flow

```text
Anonymous browser
  -> public assessment submission -> signed snapshot validation -> Neon
  <- saved report + one-hour HMAC capability
  -> public PDF route -> IP limiter -> capability verification -> bound Neon lookup -> Chromium PDF
  -> public delivery route -> IP limiter -> capability verification -> bound Neon state/claims
       -> Resend -> homeowner mailbox
       -> Resend -> ServiceM8 forwarding mailbox (must remain disabled pending privacy gate)
```

Trust boundaries are the anonymous browser/API edge, server-only signing and provider configuration, Neon persistence, Upstash distributed limiting, Chromium rendering, Resend, and ServiceM8.

## STRIDE register

| ID       | STRIDE                              | Asset and attack                                                                                      | Existing mitigation                                                                                     | Residual risk                                                                            | Rank                |
| -------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------- |
| T-SRD-01 | Spoofing                            | Caller submits another person's contact details and triggers unsolicited homeowner/ServiceM8 messages | Signed property facts, strict contact schema, consent checkbox, fixed destinations, 3/hour IP limit     | No mailbox ownership proof, CAPTCHA or equivalent abuse decision                         | High                |
| T-SRD-02 | Tampering / elevation               | Substitute assessment UUID/reference or token family to read/send another report                      | HMAC-SHA256, one-hour expiry, UUID/reference binding, DB reference match, minimum key length            | Shared secret and no `typ`/`aud`/scope claim; cross-family invariant lacks runtime proof | Medium              |
| T-SRD-03 | Information disclosure              | Steal/replay bearer capability from browser memory/devtools/XSS                                       | POST body rather than URL, no-store, bound object, short TTL                                            | No revocation or single-use; CSP baseline not configured                                 | Medium              |
| T-SRD-04 | Denial of service                   | Replay one valid token across IPs to exhaust PDF renderer/provider                                    | Per-IP Upstash limit, single renderer slot, busy/timeout errors                                         | No token/resource/global distributed budget                                              | High                |
| T-SRD-05 | Tampering / DoS                     | Multibyte/non-canonical signature reaches crypto comparison                                           | Signature character-length check and timing-safe compare                                                | Unequal byte lengths throw and become generic 502; reproduced locally                    | Medium              |
| T-SRD-06 | Injection                           | Persist active-scheme attribution URL and emit it as browser/PDF link                                 | Text/attribute escaping; renderer blocks network requests                                               | `z.url()` accepts `javascript:` and `data:`; no positive scheme/host allowlist           | Medium              |
| T-SRD-07 | Repudiation / integrity             | Race or repeat delivery and corrupt channel state                                                     | Atomic claim token/state predicates, stale-claim recovery, provider idempotency key                     | Needs real concurrent database/provider-capture E2E                                      | Medium              |
| T-SRD-08 | Information disclosure              | PII/token leaks into logs, URL, storage or evidence artefacts                                         | Minimal structured limiter logs, generic errors, token in memory/body                                   | Real-boundary log/browser/trace inspection is missing                                    | High evidence gap   |
| T-SRD-09 | Information disclosure / compliance | Provider retains or transfers PII beyond authorised safeguards                                        | Privacy notice, Neon deletion, Resend 30-day evidence, manual request runbook                           | ServiceM8 retention gate and IPP12/processor-safeguard determination unresolved          | High                |
| T-SRD-10 | Availability / integrity            | Limiter, renderer, GIS or email provider fails                                                        | Production limiter fails closed; renderer deadlines; fixed LINZ endpoint; durable failed delivery state | Production-like failure isolation is not exercised                                       | High evidence gap   |
| T-SRD-11 | Elevation / IDOR                    | Direct route access without staff sign-in                                                             | Purpose-built signed homeowner capability verified before DB access                                     | Correct capability model, but strict live-boundary proof missing                         | Medium evidence gap |
| T-SRD-12 | Repudiation                         | Abuse is not detectable without recording PII                                                         | Correlation ID and action/outcome/status logs                                                           | No current alert/monitor evidence for distributed replay or false-lead spikes            | Medium              |

## Security decisions

- ServiceM8 forwarding remains off until its retention/privacy gate is resolved; the current code path is not production authorisation.
- Object-bound bearer access is retained as the current product model, but replay, action scope, XSS/CSP and anti-automation risks require explicit remediation or documented acceptance before release.
- Missing isolated production-like E2E evidence is a blocker and cannot be replaced by mocked browser tests, unit tests or code inspection.
