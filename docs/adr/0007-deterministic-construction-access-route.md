# Keep construction-access routing deterministic

PoolReady generates a Suggested access route only from deterministic spatial evidence such as the parcel, street-facing edge, selected pool position, mapped buildings and terrain. Aerial AI may flag possible visible obstacles or uncertainty but does not choose, invent or alter the route. If deterministic evidence cannot support a credible route, PoolReady records “I’m not sure” instead of drawing one, preserving reproducibility and preventing an AI-generated path from appearing authoritative.
