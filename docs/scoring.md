# Deterministic scoring proposal

## Separation of concerns

Physical feasibility score and data confidence are separate outputs. Missing information reduces confidence; it does not automatically penalise the physical score. A category may be `unknown` and contribute a neutral/explicitly unscored result only according to a reviewed central rule—never by silently treating missing constraints as absent.

AI does not calculate score, confidence, flags, risks, or geometry.

## Category weights

| Category                              |  Points |
| ------------------------------------- | ------: |
| Available space and layout            |      25 |
| Underground services                  |      20 |
| Flooding and drainage                 |      20 |
| Terrain and slope                     |      15 |
| Planning constraints                  |      10 |
| Desktop construction-access screening |      10 |
| **Total**                             | **100** |

All thresholds, deductions, evidence requirements, and rule versions will live in one immutable configuration module with unit tests.

## Result bands

|  Score | Classification                             |
| -----: | ------------------------------------------ |
| 85–100 | Strong preliminary candidate               |
|  70–84 | Likely feasible with normal investigations |
|  50–69 | Potentially feasible but constrained       |
|  30–49 | Significant constraints                    |
|   0–29 | Low preliminary feasibility                |

Critical flags can qualify or override the normal band without altering the recorded arithmetic. The report must show the raw score, normal band, triggered flag, and final qualified recommendation.

## Confidence model

Confidence is `high`, `medium`, or `low`, calculated from address certainty, parcel certainty, required dataset availability, dataset age, infrastructure/building/terrain availability, and known title/easement gaps. Dataset inputs must state whether a zero feature count is a verified empty result or an unavailable/failed result.

The first implementation slice will define explicit points/thresholds only after Stage 2 establishes actual dataset availability and metadata quality. This avoids inventing confidence precision before the evidence landscape is known.

## Required critical flags

- Parcel could not be confidently matched.
- Major mapped infrastructure affects all apparent usable areas.
- All candidate areas substantially intersect flood hazards.
- Candidate areas cross overland flow paths.
- Severe mapped terrain constraint.
- Required core datasets are unavailable.
- Candidate appears to occupy a known restricted overlay.

## Explainability

Every category result records maximum points, awarded points, applied rule IDs, evidence references, unknown inputs, and human-readable rationale. Every output is reproducible from the saved assessment snapshot and `analysisVersion`.
