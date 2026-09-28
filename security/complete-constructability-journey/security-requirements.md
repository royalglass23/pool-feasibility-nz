# Security requirements — complete constructability journey

Mode: retrofit. Scope: RG-345 release evidence for the existing public Property Check, saved Preliminary report, and Royal Glass staff read-only view.

## Actors and assets

- Anonymous homeowner or pool builder is untrusted and may submit only their own Property Check inputs and consented contact details.
- Authenticated Royal Glass staff may read saved assessments and constructability evidence; version one has no correction, override, or verification mutation.
- Provider responses are untrusted external evidence and may be unavailable, stale, malformed, or contradictory.
- Protected assets are contact details, address and geometry, signed assessment state, saved report access, staff sessions, and provider provenance.

## Testable acceptance requirements

- Public inputs remain schema validated and signed constructability state cannot be substituted or changed between Site answers and save.
- Missing or failed providers do not produce a false clear result or prevent access to the saved report.
- Staff pages and assessment APIs deny anonymous, malformed, expired, or unknown sessions before returning assessment data.
- Staff constructability evidence is read-only and is reconstructed from the saved submission-time snapshot without rerunning providers.
- Browser tests use synthetic identities and the development database; no production data, credentials, or environment is used.
- Consent, report availability, delivery-state behavior, and saved-report semantics remain unchanged.
- Test-created sessions and records are deleted by exact identifiers even when assertions fail.

## Abuse cases and failure states

- Force-browse `/staff` or `/staff/<id>` without a valid server-side session.
- Replay or forge a staff cookie, modify a signed assessment snapshot, or submit constructability fields that do not match the signed snapshot.
- Use injection-shaped contact text or malformed route/depth values.
- Cause a provider failure and rely on the absence of evidence to obtain a clear result.
- Reuse another local app on the expected browser-test port and accidentally certify the wrong product.
- Leave privileged sessions or synthetic personal records behind after E2E execution.

## Compliance and blast radius

The journey handles personal information covered by the repository's privacy and retention controls. A complete compromise could expose saved contact, property, layout, and assessment data or enable staff-session impersonation. RG-345 adds test and evidence code only; it does not expand runtime permissions or collection.
