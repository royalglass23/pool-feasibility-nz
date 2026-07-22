# Product limitations

This application produces a preliminary desktop feasibility report based on available mapped information and deterministic screening calculations. It does not provide approval, consent advice, engineering design, construction safety assurance, a survey, title advice, utility location, or an approved pool position.

Approved baseline wording:

> Based on available mapped information, the property appears to have potential for a residential swimming pool, subject to onsite investigation, detailed design, utility locating, title review, and applicable approvals.

The application must always list unverified information including private stormwater/wastewater, exact water/drainage/electricity/gas service position and depth, easements, covenants, consent notices, geotechnical conditions, groundwater, retaining-wall condition, exact construction access, final pool barrier, final building/resource consent requirements, Works Over requirements, BeforeUdig plans, and onsite service locating.

Provider unavailability, unclear licence rights, stale coverage, low-resolution terrain, and missing title information reduce confidence. They never prove that a constraint is absent. Failure to place an automated scenario must use: `No clear candidate area was identified using the tested screening scenarios.`

Only Auckland is supported in the POC. Inputs outside the supported region return `OUTSIDE_SUPPORTED_REGION` rather than a partial national assessment.

## POC operating boundary

- Do not ask for or infer a preferred pool size, pool location, or property
  frontage. Test all configured sizes without location preference and recommend
  the largest successfully placed shell within the best-supported feasibility
  status.
- Royal Glass staff only; localhost is credential-free only during development,
  while non-loopback and deployed access fails closed without paired staff
  credentials.
- No database, durable report history, background processing, or external
  customer delivery. Refreshing or closing the browser loses the session result
  unless staff explicitly download the bounded JSON assessment.
- The AI provider is optional and may explain only validated deterministic facts.
  It cannot change geometry, candidates, size range, score, confidence, critical
  flags, risks, actions, or sources. Invalid, unsupported, timed-out, or
  unavailable AI output is replaced with deterministic wording.
- LINZ evidence may be used only with its recorded attribution. Auckland Council
  geometry remains `spike_only` pending generated-report reuse confirmation.
- Vector electricity and gas geometry is CC BY 4.0 open reference evidence. It
  may be incomplete or inaccurate and is never a substitute for BeforeUdig
  plans, provider confirmation, or onsite utility locating.
  Watercare geometry remains `internal_reference` under the recorded
  non-commercial/no-derivatives licence and must not become report evidence.
- Live GIS smoke checks are manual operational evidence. Their responses and
  screenshots are not copied into the controlled CI fixture set.
