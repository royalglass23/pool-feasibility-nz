import {
  along,
  booleanDisjoint,
  booleanValid,
  booleanWithin,
  buffer,
  distance,
  feature,
  lineString,
  nearestPointOnLine,
  point,
} from "@turf/turf";
import type { FeatureCollection, Geometry, Polygon } from "geojson";
import type { FastPropertyViewResult } from "@/modules/data-access-spike/fast-property-view";

type Coordinates = [number, number];
export type AccessRouteGeometry = {
  type: "LineString";
  coordinates: Coordinates[];
};
export type AccessRouteResult =
  | {
      confidence: "credible";
      geometry: AccessRouteGeometry;
      reason: "direct_clear_corridor";
    }
  | { confidence: "uncertain"; geometry: null; reason: string };

export type AccessRoutePlacement = {
  position: Coordinates;
  lengthMetres: number;
  widthMetres: number;
  rotationDegrees: number;
};

/** Version 1 deliberately proposes only an obvious straight corridor. */
export function suggestAccessRoute(input: {
  parcel: Polygon | null;
  address: Coordinates;
  pool: AccessRoutePlacement;
  buildingLayer: {
    state: string;
    geometry: FeatureCollection<Geometry> | null;
  } | null;
  terrainAvailable: boolean;
  terrainUpperSlopeDegrees?: number;
}): AccessRouteResult {
  const uncertain = (reason: string): AccessRouteResult => ({
    confidence: "uncertain",
    geometry: null,
    reason,
  });
  const { parcel, buildingLayer } = input;
  if (
    !parcel ||
    parcel.coordinates.length !== 1 ||
    !parcel.coordinates[0] ||
    parcel.coordinates[0].length < 4 ||
    !booleanValid(feature(parcel))
  )
    return uncertain("invalid_or_unavailable_parcel");
  if (
    !input.terrainAvailable ||
    !Number.isFinite(input.terrainUpperSlopeDegrees) ||
    input.terrainUpperSlopeDegrees! > 10
  )
    return uncertain("terrain_unavailable_or_steep");
  if (
    !buildingLayer ||
    !["returned", "verified_empty"].includes(buildingLayer.state) ||
    (buildingLayer.state === "returned" && !buildingLayer.geometry)
  )
    return uncertain("buildings_unavailable");
  const parcelFeature = feature(parcel);
  if (!booleanWithin(point(input.pool.position), parcelFeature))
    return uncertain("pool_outside_parcel");

  const ring = parcel.coordinates[0];
  const edges = ring
    .slice(0, -1)
    .map((start, index) => {
      const end = ring[index + 1]!;
      const edge = lineString([start, end]);
      const closest = nearestPointOnLine(edge, point(input.address), {
        units: "meters",
      });
      return {
        start: closest.geometry.coordinates as Coordinates,
        distanceMetres: distance(point(input.address), closest, {
          units: "meters",
        }),
        lengthMetres: distance(point(start), point(end), { units: "meters" }),
      };
    })
    .sort((a, b) => a.distanceMetres - b.distanceMetres);
  const nearest = edges[0];
  if (
    !nearest ||
    nearest.lengthMetres < 5 ||
    nearest.distanceMetres > 3 ||
    (edges[1] && edges[1].distanceMetres - nearest.distanceMetres < 4)
  )
    return uncertain("street_edge_ambiguous");

  const proposed = lineString([nearest.start, input.pool.position]);
  const lengthMetres = distance(
    point(nearest.start),
    point(input.pool.position),
    { units: "meters" },
  );
  if (lengthMetres < 3 || lengthMetres > 100)
    return uncertain("route_length_out_of_scope");
  const inset = along(proposed, 1, { units: "meters" }).geometry.coordinates;
  const interiorCorridor = buffer(
    lineString([inset, input.pool.position]),
    0.6,
    { units: "meters" },
  );
  if (!interiorCorridor || !booleanWithin(interiorCorridor, parcelFeature))
    return uncertain("no_clear_parcel_corridor");
  const corridor = buffer(proposed, 0.6, { units: "meters" });
  if (!corridor) return uncertain("no_clear_parcel_corridor");
  if (
    buildingLayer.geometry?.features.some(
      (building) =>
        !["Polygon", "MultiPolygon"].includes(building.geometry.type) ||
        !booleanValid(building) ||
        !booleanDisjoint(corridor, building),
    )
  )
    return uncertain("building_or_invalid_obstacle");
  return {
    confidence: "credible",
    geometry: {
      type: "LineString",
      coordinates: [nearest.start, input.pool.position],
    },
    reason: "direct_clear_corridor",
  };
}

export function suggestAccessRouteFromProperty(
  property: FastPropertyViewResult,
  pool: AccessRoutePlacement,
): AccessRouteResult {
  if (property.boundary.state !== "confirmed")
    return {
      confidence: "uncertain",
      geometry: null,
      reason: "parcel_identity_uncertain",
    };
  const buildings = property.detailedChecks?.layers.find(
    (layer) => layer.key === "building_footprints",
  );
  const terrain = property.detailedChecks?.terrain;
  try {
    return suggestAccessRoute({
      parcel: property.boundary.geometry,
      address: property.resolvedAddress.coordinates,
      pool,
      buildingLayer: buildings
        ? { state: buildings.state, geometry: buildings.geometry }
        : null,
      terrainAvailable:
        terrain?.status === "measured" &&
        terrain.source.evidenceUse === "report_allowed",
      terrainUpperSlopeDegrees:
        terrain?.status === "measured" ? terrain.upperSlopeDegrees : undefined,
    });
  } catch {
    return {
      confidence: "uncertain",
      geometry: null,
      reason: "invalid_spatial_evidence",
    };
  }
}
