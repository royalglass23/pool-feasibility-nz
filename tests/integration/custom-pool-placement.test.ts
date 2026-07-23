import type { FeatureCollection, Geometry, Polygon } from "geojson";
import { describe, expect, it } from "vitest";
import {
  assessCustomPoolPlacement,
  type CustomPoolPlacementEvidence,
} from "@/modules/spatial/assess-custom-pool-placement";

describe("custom pool placement public seam", () => {
  it("keeps authoritative GIS conflicts separate from the returned manual geometry", () => {
    const parcel = rectangle([174.6079, -36.8602], 0.0003, 0.00025);
    const building = rectangle([174.6079, -36.8602], 0.0001, 0.0001);
    const result = assessCustomPoolPlacement({
      parcel,
      parcelStatus: "confirmed",
      position: [174.6079, -36.8602],
      rotationDegrees: 15,
      lengthMetres: 8,
      widthMetres: 4,
      parcelEvidence: available("legal_parcel", parcel),
      buildings: available("building_footprints", building),
      constraints: [],
    });

    expect(result.classification).toBe("hard_conflict");
    expect(result.hardConflicts[0]).toMatchObject({
      type: "building_overlap",
      evidenceId: "building_footprints",
    });
    expect(result.shell).toBeDefined();
    expect(result.envelopes.access).toBeDefined();
  });

  it("does not turn incomplete evidence into clear space", () => {
    const parcel = rectangle([174.6079, -36.8602], 0.0003, 0.00025);
    const result = assessCustomPoolPlacement({
      parcel,
      parcelStatus: "confirmed",
      position: [174.6079, -36.8602],
      rotationDegrees: 0,
      lengthMetres: 8,
      widthMetres: 4,
      parcelEvidence: available("legal_parcel", parcel),
      buildings: unavailable("building_footprints"),
      constraints: [],
    });

    expect(result.classification).toBe("unknown");
    expect(result.hardConflicts).toEqual([]);
    expect(result.unknownEvidence).toContainEqual(
      expect.objectContaining({ evidenceId: "building_footprints" }),
    );
  });
});

function available(
  id: string,
  geometry: Geometry,
): CustomPoolPlacementEvidence {
  return {
    id,
    label: id,
    status: "available",
    geometry: collection([geometry]),
  };
}

function unavailable(id: string): CustomPoolPlacementEvidence {
  return { id, label: id, status: "unavailable" };
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

function rectangle(
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
