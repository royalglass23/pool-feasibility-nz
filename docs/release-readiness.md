# Internal POC release readiness

## Release boundary

This decision applies only to the internal, Auckland-only, no-database Royal
Glass POC. It authorizes neither deployment nor customer/external use. The POC
stores no assessment history and makes no approval, consent, engineering,
survey, title, utility-location, or construction-safety claim.

## Controlled release gates

Run these against the committed dependency tree without live provider calls:

```powershell
npm run typecheck
npm run lint
npm run format:check
npm test -- --pool=threads --maxWorkers=1 --configLoader=runner
npx playwright test --workers=1
npm run build
```

Controlled fixtures must cover both `42A Bahari Drive, Ranui, Auckland` and
`2/49 Pigeon Mountain Road, Half Moon Bay, Auckland`. The journey must expose
progress, exact address/parcel identity, mapped attribution and constraints,
candidates, calculated size range, assessment, narrative/fallback, and an
address-specific download. Accessibility requires labelled controls, polite
progress/error announcements, disabled duplicate submission, keyboard-operable
retry and selection controls, and focus on the completed result heading.

## Separate live smoke checks

Live checks are manual operational evidence and are never CI fixtures. With
server-only provider credentials configured locally, run:

```powershell
npm run smoke:live-layers -- "42A Bahari Drive, Ranui, Auckland"
npm run spike:verify-aerial -- "42A Bahari Drive, Ranui, Auckland"
npm run smoke:live-layers -- "2/49 Pigeon Mountain Road, Half Moon Bay, Auckland"
npm run spike:verify-aerial -- "2/49 Pigeon Mountain Road, Half Moon Bay, Auckland"
```

Record only the safe normalized pass/fail summary, exact resolved address ID,
parcel ID, visible attribution result, and check timestamp. Do not copy live
responses into `tests/fixtures`, commit generic residential screenshots, or
retain raw provider payloads. The approved 42A regression image remains the only
retained residential screenshot in this POC.

## Evidence and decision

Controlled-candidate validation date: 2026-07-21 (Pacific/Auckland).

- TypeScript, ESLint, and Prettier: pass.
- Vitest: pass, 21 files and 124 tests using one serialized thread. The runner
  config loader avoids the locked Vite temp-directory failure seen in the
  current Windows workspace. Coverage includes fail-closed narrative
  grounding, bounded OpenAI response handling, provider-host rejection, safe
  narrative outcome logging, session-download completeness, and deterministic
  front/rear/side-yard preference ranking.
- Controlled Chromium Playwright: pass, 9 journeys using one worker.
- Next.js production build: pass.
- Live-provider evidence below was last refreshed on 2026-07-20 and is recorded
  separately from the 2026-07-21 controlled candidate gates.
- Live 42A layer smoke: pass at `2026-07-20T04:37:21.573Z`; LINZ
  address `2359811`, parcel `8545868`.
- Live 42A aerial check: pass; address point inside parcel, comparison address
  outside it, tiles loaded at zoom 20, attribution visible.
- Live second-address layer smoke: pass at `2026-07-20T04:40:04.690Z`;
  LINZ address `2453674`, parcel `4789010`.
- Live second-address aerial check: pass; address point inside parcel, tiles
  loaded at zoom 20, attribution visible. Its residential screenshot was deleted
  after verification and was not added to fixtures.
- External/customer release: **NO-GO**.
- Internal local POC: **GO within the release boundary above**.
