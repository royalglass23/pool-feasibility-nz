# Security requirements — RG-364

## Scope

RG-364 polishes and validates the existing PoolReady homeowner and pool-builder wizard. It adds no endpoint, database column, permission, external recipient, or production configuration.

## Requirements

- Preserve signed assessment snapshots and server-side validation across audience, site-answer, save, delivery-status, and PDF boundaries.
- Do not expose contact details, property coordinates, report tokens, or saved reports through analytics, logs, screenshots, or unauthenticated staff routes.
- Keep retries idempotent and prevent stale placement, constructability, audience, or route evidence from being submitted.
- Retain keyboard, focus, screen-reader, touch, mobile, and 200% zoom usability on all wizard stages.
- Use only synthetic identities and the explicitly isolated development database in automated evidence.
- Require zero-retry browser evidence and an immutable commit before release sign-off.
