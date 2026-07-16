# 05 — Produce score, confidence, risks, and actions

## Parent

`famiglia/geomap-intial/contract.md`

## What to build

Turn normalized evidence and candidate results into the complete deterministic assessment: category score, classification, independent confidence, critical flags, structured risks, qualified recommendation, ordered actions, missing information, and fallback narrative.

## Acceptance criteria

- [ ] Category maxima total 100 and result bands match the contract.
- [ ] Every category records points, rule IDs, rationale, evidence references, and unknown inputs.
- [ ] Missing data reduces confidence according to explicit rules and does not automatically reduce physical score.
- [ ] All required critical flags have positive/negative/boundary tests and visibly qualify outcomes.
- [ ] Risks contain category, title, severity, evidence, source, confidence, impact, action, and specialist review.
- [ ] Actions are prioritized in the three required phases and include mandatory unverified matters.
- [ ] Deterministic narrative works with no AI configuration; any later AI output cannot add facts.
- [ ] Re-running identical evidence/version produces byte-stable structured decisions apart from timestamps/IDs.
- [ ] Typecheck, lint, tests, build, and report-page fixture proof pass.

## Blocked by

Job 04 and the Job 01 dataset-availability evidence needed to finalize confidence rules.
