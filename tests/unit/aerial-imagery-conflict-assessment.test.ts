import type { Feature, Polygon } from "geojson";
import { describe, expect, it } from "vitest";
import {
  assessAerialImageryConflicts,
  type AerialConflictCandidate,
} from "@/modules/spatial/assess-aerial-imagery-conflicts";

const envelope = rectangle(174.6079, -36.8602, 0.0001, 0.00005);
const candidate: AerialConflictCandidate = {
  id: "custom-1",
  envelope,
  dimensions: { lengthMetres: 8, widthMetres: 4 },
  rotationDegrees: 30,
};
const availableContext = {
  status: "available" as const,
  alignment: "aligned" as const,
  resolution: "sufficient" as const,
  evidenceId: "aerial_imagery",
};

describe("aerial imagery conflict assessment", () => {
  it("returns typed visible existing-pool and building-placement findings without changing the candidate", async () => {
    const result = await assessAerialImageryConflicts({
      candidate,
      context: availableContext,
      provider: {
        assess: async () => ({
          findings: [
            {
              type: "possible_existing_pool",
              affectedArea: envelope,
              confidence: "high",
              explanation:
                "A rectangular water-like feature is visible beside the candidate.",
              evidenceStatus: "observed",
              inspectionRequirement: "recommended",
            },
            {
              type: "building_roof_overlap",
              affectedArea: envelope,
              confidence: "medium",
              explanation:
                "The candidate may overlap a roof edge in the aerial image.",
              evidenceStatus: "possible",
              inspectionRequirement: "not_required",
            },
          ],
        }),
      },
    });

    expect(result.source).toBe("provider");
    expect(result.candidateId).toBe(candidate.id);
    expect(result.findings).toEqual([
      expect.objectContaining({
        type: "possible_existing_pool",
        evidenceStatus: "observed",
        inspectionRequirement: "recommended",
      }),
      expect.objectContaining({
        type: "building_roof_overlap",
        evidenceStatus: "possible",
        inspectionRequirement: "required",
      }),
    ]);
    expect(candidate).toEqual({
      id: "custom-1",
      envelope,
      dimensions: { lengthMetres: 8, widthMetres: 4 },
      rotationDegrees: 30,
    });
  });

  it("converts malformed provider output into a safe unknown finding", async () => {
    const result = await assessAerialImageryConflicts({
      candidate,
      context: availableContext,
      provider: {
        assess: async () => ({ findings: [{ type: "parcel_identity" }] }),
      },
    });

    expect(result.source).toBe("fallback");
    expect(result.findings).toEqual([
      expect.objectContaining({
        type: "image_alignment_uncertainty",
        evidenceStatus: "unknown",
        confidence: "low",
        inspectionRequirement: "required",
      }),
    ]);
  });

  it("converts a timed-out provider into the same safe fallback", async () => {
    const result = await assessAerialImageryConflicts({
      candidate,
      context: availableContext,
      timeoutMs: 1,
      provider: {
        assess: ({ signal }) =>
          new Promise((resolve) => {
            signal.addEventListener("abort", () => resolve({ findings: [] }));
          }),
      },
    });

    expect(result.source).toBe("fallback");
    expect(result.findings[0]).toMatchObject({
      type: "image_alignment_uncertainty",
      evidenceStatus: "unknown",
      inspectionRequirement: "required",
    });
  });

  it("makes unavailable imagery and unclear alignment possible conflicts requiring inspection", async () => {
    const result = await assessAerialImageryConflicts({
      candidate,
      context: {
        ...availableContext,
        status: "unavailable",
        alignment: "uncertain",
        resolution: "unavailable",
      },
    });

    expect(result.source).toBe("fallback");
    expect(result.findings.map((finding) => finding.type)).toEqual([
      "image_alignment_uncertainty",
      "image_resolution_uncertainty",
    ]);
    expect(
      result.findings.every((finding) => finding.evidenceStatus === "possible"),
    ).toBe(true);
    expect(
      result.findings.every(
        (finding) => finding.inspectionRequirement === "required",
      ),
    ).toBe(true);
  });

  it("rejects unsupported finding types and never exposes provider geometry as authoritative parcel data", async () => {
    const result = await assessAerialImageryConflicts({
      candidate,
      context: availableContext,
      provider: {
        assess: async () => ({
          findings: [
            {
              type: "driveway_access_conflict",
              affectedArea: envelope,
              confidence: "low",
              explanation: "Access may be obstructed.",
              evidenceStatus: "unknown",
              inspectionRequirement: "not_required",
            },
          ],
          parcel: rectangle(174.5, -36.8, 1, 1),
        }),
      },
    });

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({
      type: "driveway_access_conflict",
      evidenceStatus: "possible",
      inspectionRequirement: "required",
    });
    expect(result).not.toHaveProperty("parcel");
  });
});

function rectangle(
  longitude: number,
  latitude: number,
  halfLongitude: number,
  halfLatitude: number,
): Feature<Polygon> {
  return {
    type: "Feature",
    properties: {},
    geometry: {
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
    },
  };
}
