import { area, distance, point } from "@turf/turf";
import type { FeatureCollection, Geometry, Polygon } from "geojson";
import { describe, expect, it } from "vitest";
import {
  assessCustomPoolPlacement,
  type CustomPoolPlacementEvidence,
} from "@/modules/spatial/assess-custom-pool-placement";

const centre = [174.6079, -36.8602] as const;
const parcel = rectangleParcel(centre, 0.0003, 0.00025);

describe("custom pool placement assessment", () => {
  it("returns deterministic shell, construction, barrier, and access envelopes", () => {
    const result = assessCustomPoolPlacement({
      parcel,
      parcelStatus: "confirmed",
      position: centre,
      rotationDegrees: 30,
      lengthMetres: 8,
      widthMetres: 4,
      parcelEvidence: evidence("legal_parcel", collection([parcel])),
      buildings: evidence("building_footprints", collection([])),
      constraints: [],
    });

    expect(result.classification).toBe("clear");
    expect(result.shell.geometry.type).toBe("Polygon");
    expect(result.envelopes).toEqual(
      expect.objectContaining({
        constructionAllowance: expect.objectContaining({ type: "Feature" }),
        barrier: expect.objectContaining({ type: "Feature" }),
        access: expect.objectContaining({ type: "Feature" }),
      }),
    );
    expect(area(result.shell)).toBeCloseTo(32, 0);
    expect(result.rotationDegrees).toBe(30);
    expect(result.position).toEqual(centre);
    expect(result.shell).toEqual(
      assessCustomPoolPlacement({
        parcel,
        parcelStatus: "confirmed",
        position: centre,
        rotationDegrees: 30,
        lengthMetres: 8,
        widthMetres: 4,
        parcelEvidence: evidence("legal_parcel", collection([parcel])),
        buildings: evidence("building_footprints", collection([])),
        constraints: [],
      }).shell,
    );
  });

  it("preserves metre dimensions and coordinate conventions when rotated", () => {
    const result = assessCustomPoolPlacement({
      parcel,
      parcelStatus: "confirmed",
      position: centre,
      rotationDegrees: 90,
      lengthMetres: 8,
      widthMetres: 4,
      parcelEvidence: evidence("legal_parcel", collection([parcel])),
      buildings: evidence("building_footprints", collection([])),
      constraints: [],
    });
    const [first, second] = result.shell.geometry.coordinates[0];

    expect(
      distance(point(first), point(second), { units: "meters" }),
    ).toBeCloseTo(8, 1);
    expect(first[0]).toBeGreaterThan(174);
    expect(first[0]).toBeLessThan(175);
    expect(first[1]).toBeGreaterThan(-37);
    expect(first[1]).toBeLessThan(-36);
  });

  it.each([
    [undefined, 4, "length"],
    [0, 4, "length"],
    [-1, 4, "length"],
    [31, 4, "length"],
    [8, undefined, "width"],
    [8, 0, "width"],
    [8, -1, "width"],
    [8, 31, "width"],
  ])(
    "rejects invalid custom %s dimensions",
    (lengthMetres, widthMetres, field) => {
      expect(() =>
        assessCustomPoolPlacement({
          parcel,
          parcelStatus: "confirmed",
          position: centre,
          rotationDegrees: 0,
          lengthMetres,
          widthMetres,
          parcelEvidence: evidence("legal_parcel", collection([parcel])),
          buildings: evidence("building_footprints", collection([])),
          constraints: [],
        }),
      ).toThrow(new RegExp(field, "i"));
    },
  );

  it("reports hard GIS conflicts and unknown evidence without hiding geometry", () => {
    const building = rectangleParcel(centre, 0.0001, 0.0001);
    const result = assessCustomPoolPlacement({
      parcel,
      parcelStatus: "confirmed",
      position: centre,
      rotationDegrees: 0,
      lengthMetres: 8,
      widthMetres: 4,
      parcelEvidence: evidence("legal_parcel", collection([parcel])),
      buildings: evidence("building_footprints", collection([building])),
      constraints: [evidence("measured_exclusion", collection([building]))],
    });

    expect(result.classification).toBe("hard_conflict");
    expect(result.hardConflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "building_overlap" }),
        expect.objectContaining({ type: "measured_constraint_intersection" }),
      ]),
    );
    expect(result.shell).toBeDefined();

    const unknown = assessCustomPoolPlacement({
      parcel,
      parcelStatus: "confirmed",
      position: centre,
      rotationDegrees: 0,
      lengthMetres: 8,
      widthMetres: 4,
      parcelEvidence: evidence("legal_parcel", collection([parcel])),
      buildings: evidence("building_footprints", undefined),
      constraints: [evidence("unavailable_constraint", undefined)],
    });
    expect(unknown.classification).toBe("unknown");
    expect(unknown.unknownEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ evidenceId: "building_footprints" }),
        expect.objectContaining({ evidenceId: "unavailable_constraint" }),
      ]),
    );
    expect(unknown.hardConflicts).toEqual([]);
  });

  it("treats leaving the confirmed parcel as a hard conflict", () => {
    const result = assessCustomPoolPlacement({
      parcel: rectangleParcel(centre, 0.00005, 0.00005),
      parcelStatus: "confirmed",
      position: centre,
      rotationDegrees: 0,
      lengthMetres: 8,
      widthMetres: 4,
      parcelEvidence: evidence("legal_parcel", collection([parcel])),
      buildings: evidence("building_footprints", collection([])),
      constraints: [],
    });

    expect(result.classification).toBe("hard_conflict");
    expect(result.hardConflicts).toContainEqual(
      expect.objectContaining({ type: "outside_confirmed_parcel" }),
    );
  });
});

function evidence(
  id: string,
  geometry: FeatureCollection<Geometry> | undefined,
): CustomPoolPlacementEvidence {
  return {
    id,
    label: id,
    status: geometry ? "available" : "unavailable",
    ...(geometry ? { geometry } : {}),
  };
}

function collection(geometries: Geometry[]): FeatureCollection<Geometry> {
  return {
    type: "FeatureCollection",
    features: geometries.map((geometry) => ({
      type: "Feature",
      properties: {},
      geometry,
    })),
  };
}

function rectangleParcel(
  [longitude, latitude]: readonly [number, number],
  halfLongitude: number,
  halfLatitude: number,
): Polygon {
  return {
    type: "Polygon",
    coordinates: [
      [
        [longitude - halfLongitude, latitude - halfLatitude],
        [longitude + halfLongitude, latitude - halfLatitude],
        [longitude + halfLongitude, latitude + halfLatitude],
        [longitude - halfLongitude, latitude + halfLatitude],
        [longitude - halfLongitude, latitude - halfLatitude],
      ],
    ],
  };
}
