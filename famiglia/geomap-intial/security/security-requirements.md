# Security requirements — Job 01 official data-access spike

## Actors and trust

- The local developer/operator is trusted to access local credentials and run
  verification commands.
- Supplied addresses and all remote provider responses are untrusted input.
- LINZ and Auckland Council are approved external systems, but their returned
  JSON, GeoJSON, identifiers, and imagery metadata require validation.
- LINZ credentials are secrets and may exist only in ignored environment files
  or transient authenticated HTTPS requests.

## Testable requirements

1. Reject missing, malformed, oversized, non-Auckland, ambiguous, and
   wrong-parcel inputs with stable safe error codes.
2. Restrict outbound requests to fixed official origins and bound request time,
   streamed response bytes, feature counts, ring counts, and ring vertices.
3. Prevent provider-controlled identifiers from escaping the verification
   artifact directory.
4. Keep provider keys out of source, stdout, safe errors, screenshots, and Git.
5. HTML-encode provider-derived map labels and never create or infer unavailable
   spatial findings.
6. Keep conditionally licensed Council evidence `spike_only` and Watercare
   evidence unavailable until reuse rights are suitable.
7. Ignore generic property screenshots and retain only the approved regression
   artifact.
8. Ship no dependency with a known applicable vulnerability; keep non-shipped
   toolchain risk documented and constrained.

## Abuse cases and blast radius

Credible abuse includes query injection, malicious provider identifiers,
oversized or invalid GeoJSON, unknown-length response flooding, SSRF attempts,
credential leakage, provider-quota exhaustion, and unnecessary retention of a
precise residential map. Compromise is limited to the local process and its
writable files because Job 01 has no public API, database, authentication system,
or production deployment.

No compliance framework is declared in `famiglia/profile.json`. Residential
addresses are nevertheless treated as personal information in context.
