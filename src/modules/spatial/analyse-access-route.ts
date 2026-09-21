import {
  bearing,
  booleanDisjoint,
  booleanValid,
  booleanWithin,
  buffer,
  distance,
  feature,
  lineIntersect,
  lineString,
  nearestPointOnLine,
  point,
  pointToLineDistance,
} from "@turf/turf";
import type { FeatureCollection, Geometry, Polygon } from "geojson";
import type { FastPropertyViewResult } from "@/modules/data-access-spike/fast-property-view";
import type { TerrainSlopeSample } from "@/modules/terrain/property-terrain";
import type { AccessRouteGeometry } from "./suggest-access-route";

export type RouteFact<T> =
  | { status: "assessed"; value: T }
  | { status: "not_assessed"; reason: "invalid_geometry" | "data_unavailable" };
export type AccessRouteFacts = {
  valid: boolean;
  length: RouteFact<number>;
  elevationChange: RouteFact<number>;
  steepestGradient: RouteFact<number>;
  parcelDeparture: RouteFact<boolean>;
  buildings: RouteFact<boolean>;
  services: RouteFact<boolean>;
};
type Layer = { state: string; geometry: FeatureCollection<Geometry> | null };
const missing = { status: "not_assessed", reason: "data_unavailable" } as const;
const invalid = { status: "not_assessed", reason: "invalid_geometry" } as const;
const assessed = <T>(value: T): RouteFact<T> => ({ status: "assessed", value });

export function analyseAccessRoute(input: {
  route: AccessRouteGeometry;
  parcel: Polygon | null;
  buildings: Layer | null;
  services: Layer[];
  terrain: { status: string; samples?: TerrainSlopeSample[] } | null;
}): AccessRouteFacts {
  const coordinates = input.route.coordinates;
  const valid =
    coordinates.length >= 2 &&
    coordinates.length <= 4 &&
    coordinates.every(
      ([longitude, latitude], index) =>
        Number.isFinite(longitude) &&
        longitude >= 160 &&
        longitude <= 180 &&
        Number.isFinite(latitude) &&
        latitude >= -48 &&
        latitude <= -33 &&
        (index === 0 ||
          longitude !== coordinates[index - 1]![0] ||
          latitude !== coordinates[index - 1]![1]),
    ) &&
    !coordinates.slice(0, -1).some(
      (start, index) =>
        distance(point(start), point(coordinates[index + 1]!), {
          units: "meters",
        }) < 0.1,
    );
  if (!valid)
    return {
      valid: false,
      length: invalid,
      elevationChange: invalid,
      steepestGradient: invalid,
      parcelDeparture: invalid,
      buildings: invalid,
      services: invalid,
    };
  const line = lineString(coordinates);
  if (
    coordinates.length === 4 &&
    lineIntersect(
      lineString(coordinates.slice(0, 2)),
      lineString(coordinates.slice(2)),
    ).features.length > 0
  )
    return {
      valid: false,
      length: invalid,
      elevationChange: invalid,
      steepestGradient: invalid,
      parcelDeparture: invalid,
      buildings: invalid,
      services: invalid,
    };
  const length = coordinates.slice(1).reduce(
    (total, current, index) =>
      total +
      distance(point(coordinates[index]!), point(current), {
        units: "meters",
      }),
    0,
  );
  const parcelDeparture =
    input.parcel && booleanValid(feature(input.parcel))
      ? assessed(!booleanWithin(line, feature(input.parcel)))
      : missing;
  const buildings = intersectionFact(line, input.buildings, 0);
  const serviceFacts = input.services.map((layer) =>
    intersectionFact(line, layer, 1),
  );
  const services = serviceFacts.some(
    (fact) => fact.status === "assessed" && fact.value,
  )
    ? assessed(true)
    : serviceFacts.length &&
        serviceFacts.every((fact) => fact.status === "assessed")
      ? assessed(false)
      : missing;
  const samples =
    input.terrain?.status === "measured" ? (input.terrain.samples ?? []) : [];
  const routeGradientSamples = samples
    .flatMap((sample) => {
      if (
        !Number.isFinite(sample.eastGradient) ||
        !Number.isFinite(sample.northGradient)
      )
        return [];
      const nearest = nearestPointOnLine(line, point(sample.position), {
        units: "meters",
      });
      const offsetMetres = nearest.properties.location;
      const rawSegmentIndex = nearest.properties.segmentIndex;
      if (
        typeof offsetMetres !== "number" ||
        typeof rawSegmentIndex !== "number" ||
        offsetMetres < 0 ||
        rawSegmentIndex < 0 ||
        pointToLineDistance(point(sample.position), line, { units: "meters" }) >
          3
      )
        return [];
      const segmentIndex = Math.min(rawSegmentIndex, coordinates.length - 2);
      const headingRadians =
        (bearing(
          point(coordinates[segmentIndex]!),
          point(coordinates[segmentIndex + 1]!),
        ) *
          Math.PI) /
        180;
      const alongRouteGradient =
        sample.eastGradient * Math.sin(headingRadians) +
        sample.northGradient * Math.cos(headingRadians);
      return [
        {
          offsetMetres,
          gradientDegrees: radiansToDegrees(
            Math.atan(Math.abs(alongRouteGradient)),
          ),
        },
      ];
    })
    .sort((left, right) => left.offsetMetres - right.offsetMetres);
  const terrainCoverageComplete =
    routeGradientSamples.length >= 2 &&
    routeGradientSamples[0]!.offsetMetres <= 3 &&
    length - routeGradientSamples.at(-1)!.offsetMetres <= 3 &&
    routeGradientSamples
      .slice(1)
      .every(
        (sample, index) =>
          sample.offsetMetres - routeGradientSamples[index]!.offsetMetres <= 6,
      );
  const steepestGradient = terrainCoverageComplete
    ? assessed(
        Math.round(
          Math.max(
            ...routeGradientSamples.map((sample) => sample.gradientDegrees),
          ) * 10,
        ) / 10,
      )
    : missing;
  const endpointElevation = (coordinate: [number, number]) =>
    samples
      .filter((sample) => Number.isFinite(sample.elevationMetres))
      .map((sample) => ({
        sample,
        distance: distance(point(coordinate), point(sample.position), {
          units: "meters",
        }),
      }))
      .sort((a, b) => a.distance - b.distance)[0];
  const first = endpointElevation(coordinates[0]!);
  const last = endpointElevation(coordinates.at(-1)!);
  const elevationChange =
    first && last && first.distance <= 2 && last.distance <= 2
      ? assessed(
          Math.round(
            (last.sample.elevationMetres! - first.sample.elevationMetres!) * 10,
          ) / 10,
        )
      : missing;
  return {
    valid: true,
    length: assessed(Math.round(length * 10) / 10),
    elevationChange,
    steepestGradient,
    parcelDeparture,
    buildings,
    services,
  };
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function intersectionFact(
  line: ReturnType<typeof lineString>,
  layer: Layer | null,
  proximityMetres: number,
): RouteFact<boolean> {
  if (!layer || !["returned", "verified_empty"].includes(layer.state))
    return missing;
  if (layer.state === "verified_empty") return assessed(false);
  if (
    !layer.geometry ||
    !layer.geometry.features.every((item) => booleanValid(item))
  )
    return missing;
  const corridor = proximityMetres
    ? buffer(line, proximityMetres, { units: "meters" })
    : null;
  return assessed(
    layer.geometry.features.some((item) => {
      if (!booleanDisjoint(line, item)) return true;
      if (!proximityMetres) return false;
      if (item.geometry.type === "Point")
        return (
          pointToLineDistance(point(item.geometry.coordinates), line, {
            units: "meters",
          }) <= proximityMetres
        );
      return Boolean(corridor && !booleanDisjoint(corridor, item));
    }),
  );
}

const serviceKeys = new Set([
  "public_stormwater_assets",
  "manholes",
  "catchpits",
  "wastewater_assets",
  "wastewater_manholes",
  "wastewater_fittings",
  "public_water_assets",
  "water_fittings",
  "electricity_feeder_lines",
  "gas_distribution_lines",
]);
export function analyseAccessRouteFromProperty(
  property: FastPropertyViewResult,
  route: AccessRouteGeometry,
): AccessRouteFacts {
  const layers = property.detailedChecks?.layers ?? [];
  const terrain = property.detailedChecks?.terrain;
  const reportable = (key: string): Layer | null => {
    const layer = layers.find((candidate) => candidate.key === key);
    return layer?.evidence?.evidenceUse === "report_allowed" ? layer : null;
  };
  try {
    return analyseAccessRoute({
      route,
      parcel:
        property.boundary.state === "confirmed"
          ? property.boundary.geometry
          : null,
      buildings: reportable("building_footprints"),
      services: [...serviceKeys].map(
        (key) => reportable(key) ?? { state: "unavailable", geometry: null },
      ),
      terrain:
        terrain?.status === "measured" &&
        terrain.source.evidenceUse === "report_allowed"
          ? { status: "measured", samples: terrain.slopeSamples }
          : null,
    });
  } catch {
    return {
      valid: true,
      length: missing,
      elevationChange: missing,
      steepestGradient: missing,
      parcelDeparture: missing,
      buildings: missing,
      services: missing,
    };
  }
}
