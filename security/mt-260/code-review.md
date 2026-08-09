# Independent code review - MT-260 launch controls

- Mode: initial two-axis review
- Pinned range: `cc3f9204a772df716852576186c35079aabbed90...ebed3ef5f61db2bd5bb7a9450145f2d099446f92`
- Uncommitted files, including the user-owned `pnpm-lock.yaml`, were excluded.

## Standards

### STD-001

- Severity: blocking
- Location: `src/app/api/public/report/pdf/route.ts`, `src/app/api/public/aerial-conflicts/route.ts`, and related anonymous address/tile adapters
- Citation: `docs/public-rate-limiting.md` requires the rate-limit check before property providers and PDF work.
- Evidence: only `POST /api/public/property-check`, its signed stage route, and `POST /api/public/assessments` use the shared limiter. Direct public PDF/provider adapters do not.
- Remediation: agree budgets for these public seams, then enforce them before costly work without double-charging the legitimate journey.
- Fingerprint: `Standards|public-costly-routes|rate-limit-before-provider-pdf|unlimited-work`
- Status: still-open

### STD-002

- Severity: blocking
- Location: `security/public-lead-capture/e2e-results.json`, `security/public-lead-capture/signoff.md`
- Citation: `docs/public-lead-capture-implementation-plan.md` requires isolated production-build E2E, zero retries, exact-commit validation, and rerun sign-off.
- Evidence: the committed artifacts review `cc3f920`, cover zero strict rows, and predate `ebed3ef`.
- Remediation: run and validate the strict matrix against the exact candidate, then regenerate sign-off.
- Fingerprint: `Standards|security-evidence|exact-commit-strict-e2e|stale-blocked-proof`
- Status: blocked; current MT-260 evidence now references HEAD but strict execution remains unavailable.

### STD-003

- Severity: minor
- Location: `src/modules/rate-limit/public-rate-limit.ts`
- Citation: Fowler smell baseline, Duplicated Code (judgement call)
- Evidence: quotas/windows are encoded once as millisecond policies and again as Upstash literals.
- Remediation: construct local and distributed limiters from one typed policy definition.
- Fingerprint: `Smell|public-rate-limit.ts|Duplicated Code|dual-policy-values`
- Status: still-open

## Spec

### SPEC-001

- Severity: blocking
- Location: strict public/Admin E2E lane
- Citation: MT-260 anonymous journey and unauthenticated Admin-boundary acceptance criteria
- Evidence: zero executable strict rows prove the public journey or Admin forced-browsing denial against real routing/persistence.
- Remediation: implement and run the anonymous journey plus Staff list/detail/PDF/API denial matrix against the exact candidate.
- Fingerprint: `Spec|strict-e2e|public-and-admin-boundaries|zero-coverage`
- Status: still-open

### SPEC-002

- Severity: blocking
- Location: isolated auth/rate-limit/delivery fixtures
- Citation: MT-260 real fixture account, distributed store, isolated database/delivery, and zero-retry requirements
- Evidence: database integration tests skip without dedicated environment keys; rate-limit and delivery results are local/mock evidence only.
- Remediation: execute the controls with dedicated disposable database, distributed limiter, and delivery fixtures.
- Fingerprint: `Spec|isolated-fixtures|auth-rate-limit-delivery|not-executed`
- Status: blocked

### SPEC-003

- Severity: blocking
- Location: delivery, retention, and analytics real boundaries
- Citation: MT-260 payload inspection, disposable retention deletion, and consent analytics criteria
- Evidence: current checks are unit/component based; no capture proves outbound payloads, deletion outcome, or GA4 network payloads.
- Remediation: inspect dedicated captures and actual disposable-row deletion in the strict environment.
- Fingerprint: `Spec|data-boundaries|payload-retention-analytics|mock-only`
- Status: blocked

### SPEC-004

- Severity: blocking
- Location: committed `security/public-lead-capture` sign-off
- Citation: MT-260 exact environment/fixture/command/timestamp/failure evidence and honest verdict
- Evidence: committed sign-off is stale at `cc3f920`; this MT-260 rerun now identifies HEAD but cannot execute the strict lane.
- Remediation: provision and execute the current validator-backed lane.
- Fingerprint: `Spec|signoff|candidate-identity|stale`
- Status: blocked; stale identity is corrected in the new evidence, required execution is not.

### SPEC-005

- Severity: important
- Location: committed logs, address-specific Puhoi reports/images, prototype assets, and unrelated research in the reviewed range
- Citation: MT-260 is a bounded release-evidence ticket
- Evidence: the candidate includes material unrelated to launch security proof and privacy-sensitive residential artifacts.
- Remediation: review and separate/remove only with explicit approval; do not delete user artifacts implicitly.
- Fingerprint: `Spec|scope|release-evidence|unrelated-assets`
- Status: still-open

## Summary

- Standards: 3 findings; worst severity blocking.
- Spec: 5 findings; worst severity blocking.
- No remediation cycle was started: the first accepted blockers require external fixture provisioning, product decisions for new public-route budgets, and explicit authority before removing committed user artifacts.

## Verification review

- Verdict: **NOT CLEAR**
- `STD-001`: still-open
- `STD-002`: blocked
- `STD-003`: still-open
- `SPEC-001`: still-open
- `SPEC-002`: blocked
- `SPEC-003`: blocked
- `SPEC-004`: blocked
- `SPEC-005`: still-open
- No new blocking regression was introduced by the evidence-only remediation. The red full suite is an additional release gate, not a regression introduced by these files.
