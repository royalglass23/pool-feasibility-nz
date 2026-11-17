import { expect, it } from "vitest";
import type { FeatureCollection } from "geojson";
import { withContourElevationLabels } from "@/components/map/contour-elevation-labels";

it.each([
  [{ Elevation: 50 }, "50 m"],
  [{ elevation: "50.25" }, "50.25 m"],
  [{ ELEVATION: 0 }, "0 m"],
  [{ Elevation: -0.25 }, "-0.25 m"],
  [{}, ""],
  [{ Elevation: null }, ""],
  [{ Elevation: " " }, ""],
  [{ Elevation: "unknown" }, ""],
  [{ Elevation: true }, ""],
  [{ Elevation: Infinity }, ""],
])("labels only usable source elevations: %j", (properties, label) => {
  const geometry: FeatureCollection = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties,
        geometry: {
          type: "LineString",
          coordinates: [
            [174.6, -36.8],
            [174.61, -36.81],
          ],
        },
      },
    ],
  };
  const labelled = withContourElevationLabels(geometry);
  expect(labelled.features[0].properties?.contourElevationLabel).toBe(label);
  expect(geometry.features[0].properties).toEqual(properties);
  expect(labelled.features[0].geometry).toEqual(geometry.features[0].geometry);
});
