# Security tests - customer-address

## Required before release

- Direct unauthenticated access to every existing `/api/internal/*` route remains denied.
- Authenticated internal suggestions accept only `q` length 3-100 and return no more than eight results.
- Authenticated internal assessment accepts only the bounded address schema and a bounded selected ID.
- Oversized bodies, malformed JSON, control characters, ArcGIS injection-shaped text, and encoding edge cases return stable safe errors.
- Provider failures return no stack, URL, key, raw payload, or submitted address echo.
- Stale or foreign selected IDs cannot confirm a parcel outside the current suggestion set.
- Distributed rate limiting is not required for this login-protected POC; reassess before anonymous release.
- Browser inspection confirms no address or secret is placed in query parameters beyond the bounded search text, local storage, downloads, or retained traces.

## Current results

The authenticated internal route remains protected. Full security evidence is still incomplete; anonymous access and rate limiting are deferred POC scope.
