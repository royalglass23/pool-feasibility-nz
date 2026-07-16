# Product limitations

This application produces a preliminary desktop feasibility report based on available mapped information and deterministic screening calculations. It does not provide approval, consent advice, engineering design, construction safety assurance, a survey, title advice, utility location, or an approved pool position.

Approved baseline wording:

> Based on available mapped information, the property appears to have potential for a residential swimming pool, subject to onsite investigation, detailed design, utility locating, title review, and applicable approvals.

The application must always list unverified information including private stormwater/wastewater, exact pipe position and depth, easements, covenants, consent notices, geotechnical conditions, groundwater, retaining-wall condition, exact construction access, final pool barrier, final building/resource consent requirements, Works Over requirements, and onsite service locating.

Provider unavailability, unclear licence rights, stale coverage, low-resolution terrain, and missing title information reduce confidence. They never prove that a constraint is absent. Failure to place an automated scenario must use: `No clear candidate area was identified using the tested screening scenarios.`

Only Auckland is supported in the POC. Inputs outside the supported region return `OUTSIDE_SUPPORTED_REGION` rather than a partial national assessment.
