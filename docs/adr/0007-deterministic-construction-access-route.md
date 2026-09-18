# Keep construction-access routing deterministic

PoolReady generates a Suggested access route only from deterministic spatial evidence such as the parcel, street-facing edge, selected pool position, mapped buildings and terrain. Aerial AI may flag possible visible obstacles or uncertainty but does not choose, invent or alter the route. If deterministic evidence cannot support a credible route, PoolReady records “I’m not sure” instead of drawing one, preserving reproducibility and preventing an AI-generated path from appearing authoritative.

## Version 1 route policy

The official address point is a **frontage proxy**, not proof of a legal street entrance or vehicle crossing. A route is suggested only when the point is within 3 m of one valid parcel edge, that edge is at least 5 m long, and the next closest edge is at least 4 m farther away. This deliberately excludes interior address points and corner ambiguity. The mapped parcel must be a valid single-ring polygon; the pool centre must be inside it.

The policy tries one straight line from the nearest point on that edge to the selected pool centre. It suggests no detour. The line must be between 3 m and 100 m long. A 0.6 m corridor, tested from 1 m inside the edge, must stay within the parcel and avoid every mapped building polygon. Building evidence must be returned or verified empty. Terrain must be measured, eligible for report use, and have an upper slope of at most 10 degrees. These thresholds are conservative **suggestion gates**, not machinery-clearance or construction-suitability standards. An unavailable input, invalid geometry, blocked corridor, or failed gate produces no line and an uncertain route answer.

The route policy version and reason are recorded with the signed Site answers. The suggestion is recomputed from the saved spatial snapshot and submitted pool layout before final save. User confirmation is persisted as `confirmed`; “I’m not sure” persists `uncertain` with no confirmed route geometry. Aerial findings remain separate possible obstacles and never enter this route calculation. Route adjustment and route facts belong to RG-341.
