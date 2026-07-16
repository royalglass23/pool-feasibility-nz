# Licensing gate refresh

> Historical checkpoint: the credential state below was superseded later on
> 2026-07-16. An authorised Basemaps key was configured and the authenticated
> aerial/alignment gate passed. The Auckland Council and Watercare licensing
> conclusions remain current.

Checked 2026-07-16 while resuming Job 01.

## Environment

- `LINZ_BASEMAPS_API_KEY` is not configured in the process environment.
- Neither `.env.local` nor `.env` exists in the repository.
- No credential value was printed or stored.

## Auckland Council finding

The official Auckland Council geospatial terms still state that the service may
be used for personal and business purposes, but a substantial amount of its
information may not be copied or republished without prior written consent. The
terms also describe the information as illustrative/indicative and require
independent verification.

The official Auckland Council Open Data Search API documents programmatic
catalogue access, but the inspected material does not add a clearer general
licence authorising the proposed generated commercial reports and static PDFs.
Public technical access is therefore not treated as report-republication
permission.

## Enforced application decision

Every spike dataset observation now exposes an `evidenceUse` value:

- `report_allowed`: successfully retrieved evidence with recorded permissive
  reuse terms, currently LINZ address/parcel/building evidence and authorised
  Basemaps imagery when available.
- `spike_only`: technically retrieved Auckland Council evidence pending the
  required reuse review or written permission.
- `unavailable`: data not retrieved or not authorised for the intended use,
  including Watercare automation and Basemaps without a key.

The aggregate result separately returns `reportEligibleDatasets` and
`spikeOnlyDatasets`. A successful Council API response cannot enter the former
while its licence remains conditional.

## Gate result

At this checkpoint Job 01 remained blocked. The later Basemaps verification
removed the aerial blocker; Auckland Council report/PDF reuse remains conditional
until the position is accepted or confirmed in writing.
