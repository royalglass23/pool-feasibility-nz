import { describe, expect, it, vi } from "vitest";
import type { Polygon } from "geojson";
import {
  projectNztmPolygonToWgs84,
  projectWgs84PolygonToNztm,
} from "@/modules/providers/linz/project-auckland-dem-geometry";

vi.mock("server-only", () => ({}));

describe("Auckland DEM geometry projection", () => {
  it("projects the 42A longitude-latitude fixture into metre-based NZTM2000 coordinates", () => {
    const footprint: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [174.607906917203, -36.8602038189915],
          [174.607918132, -36.860203668],
          [174.607906729, -36.860194809],
          [174.607906917203, -36.8602038189915],
        ],
      ],
    };

    const projected = projectWgs84PolygonToNztm(footprint);
    const [addressPoint, oneMetreEast] = projected.coordinates[0];

    // Fixed independently with the LINZ Concord NZGD2000 -> NZTM API.
    expect(addressPoint[0]).toBeCloseTo(1_743_332.0443, 3);
    expect(addressPoint[1]).toBeCloseTo(5_919_428.8718, 3);
    expect(
      Math.hypot(
        oneMetreEast[0] - addressPoint[0],
        oneMetreEast[1] - addressPoint[1],
      ),
    ).toBeCloseTo(1, 3);
  });

  it("round-trips a padded NZTM analysis window for catalogue intersection", () => {
    const nztmWindow: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [1_743_300, 5_919_400],
          [1_743_380, 5_919_400],
          [1_743_380, 5_919_480],
          [1_743_300, 5_919_480],
          [1_743_300, 5_919_400],
        ],
      ],
    };

    const roundTrip = projectWgs84PolygonToNztm(
      projectNztmPolygonToWgs84(nztmWindow),
    );

    roundTrip.coordinates[0].forEach((position, index) => {
      expect(position[0]).toBeCloseTo(nztmWindow.coordinates[0][index][0], 4);
      expect(position[1]).toBeCloseTo(nztmWindow.coordinates[0][index][1], 4);
    });
  });

  it("rejects a construction-envelope ring that is not closed", () => {
    const openFootprint: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [174.607906917203, -36.8602038189915],
          [174.607918132, -36.860203668],
          [174.607906729, -36.860194809],
          [174.607895513, -36.86019496],
        ],
      ],
    };

    expect(() => projectWgs84PolygonToNztm(openFootprint)).toThrowError(
      "Invalid WGS84 polygon: every linear ring must be closed.",
    );
  });

  it("rejects a sparse construction-envelope ring", () => {
    const sparseRing: Polygon["coordinates"][number] = new Array(4);
    sparseRing[0] = [174.607906917203, -36.8602038189915];
    sparseRing[2] = [174.607906729, -36.860194809];
    sparseRing[3] = [174.607906917203, -36.8602038189915];
    const sparseFootprint: Polygon = {
      type: "Polygon",
      coordinates: [sparseRing],
    };

    expect(() => projectWgs84PolygonToNztm(sparseFootprint)).toThrowError(
      "Invalid WGS84 polygon: every linear ring position must be present.",
    );
  });

  it("rejects a construction-envelope ring with fewer than four positions", () => {
    const shortFootprint: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [174.607906917203, -36.8602038189915],
          [174.607918132, -36.860203668],
          [174.607906917203, -36.8602038189915],
        ],
      ],
    };

    expect(() => projectWgs84PolygonToNztm(shortFootprint)).toThrowError(
      "Invalid WGS84 polygon: every linear ring needs at least four positions.",
    );
  });

  it("rejects a construction-envelope position with a missing latitude", () => {
    const incompleteFootprint: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [174.607906917203],
          [174.607918132, -36.860203668],
          [174.607906729, -36.860194809],
          [174.607906917203],
        ],
      ],
    };

    expect(() => projectWgs84PolygonToNztm(incompleteFootprint)).toThrowError(
      "Invalid WGS84 polygon: positions require finite longitude and latitude within WGS84 bounds.",
    );
  });

  it.each([
    [Number.NaN, -36.8602038189915],
    [181, -36.8602038189915],
    [174.607906917203, -91],
  ])(
    "rejects a construction envelope with invalid WGS84 ordinates (%s, %s)",
    (longitude, latitude) => {
      const footprint: Polygon = {
        type: "Polygon",
        coordinates: [
          [
            [longitude, latitude],
            [174.607918132, -36.860203668],
            [174.607906729, -36.860194809],
            [longitude, latitude],
          ],
        ],
      };

      expect(() => projectWgs84PolygonToNztm(footprint)).toThrowError(
        "Invalid WGS84 polygon: positions require finite longitude and latitude within WGS84 bounds.",
      );
    },
  );
});
