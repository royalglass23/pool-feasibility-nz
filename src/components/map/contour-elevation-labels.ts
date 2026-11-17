import type { FeatureCollection } from "geojson";

/** Keep absent or invalid elevation values from becoming misleading 0 m labels. */
export function withContourElevationLabels(
  geometry: FeatureCollection,
): FeatureCollection {
  return {
    ...geometry,
    features: geometry.features.map((feature) => {
      const value = Object.entries(feature.properties ?? {}).find(
        ([key]) => key.toLowerCase() === "elevation",
      )?.[1];
      const elevation =
        typeof value === "number" ||
        (typeof value === "string" && value.trim() !== "")
          ? Number(value)
          : Number.NaN;
      return {
        ...feature,
        properties: {
          ...feature.properties,
          contourElevationLabel: Number.isFinite(elevation)
            ? `${elevation} m`
            : "",
        },
      };
    }),
  };
}
