import { describe, expect, it } from "vitest";
import {
  reportExcavationGeometry,
  reportMapLegend,
  reportWarningLabel,
} from "@/modules/reporting/preliminary-report-presentation";
import { buildConstructabilitySnapshot } from "@/modules/assessment/constructability-evidence";
import { buildTestPreliminaryReport } from "../fixtures/preliminary-report";

describe("captured pool legend", () => {
  it("identifies a captured suggested route when the homeowner is unsure", () => {
    const report = buildTestPreliminaryReport({
      mapImageSource: "fast_property_view_capture",
      constructability: buildConstructabilitySnapshot({
        answers: {
          version: 1,
          estimatedDepthMetres: 1.5,
          route: { provenance: "uncertain", geometry: null },
          accessConditions: ["not_sure"],
          nearbyFeatures: ["not_sure"],
        },
        routePolicyVersion: 1,
        suggestedRoute: {
          type: "LineString",
          coordinates: [
            [174.76, -36.85],
            [174.76015, -36.8499],
          ],
        },
      }),
    });

    expect(reportMapLegend(report).entries).toContainEqual(
      expect.objectContaining({
        id: "suggested-access-route",
        label: "Suggested access route",
        colour: "#1d4ed8",
        kind: "line",
        dashed: true,
      }),
    );
  });
  it("labels the captured adjusted route as user supplied", () => {
    const suggestedRoute = {
      type: "LineString" as const,
      coordinates: [
        [174.76, -36.85],
        [174.76015, -36.8499],
      ] as [number, number][],
    };
    const report = buildTestPreliminaryReport({
      mapImageSource: "fast_property_view_capture",
      constructability: buildConstructabilitySnapshot({
        answers: {
          version: 1,
          estimatedDepthMetres: 1.5,
          route: {
            provenance: "user-supplied",
            geometry: {
              type: "LineString",
              coordinates: [
                suggestedRoute.coordinates[0]!,
                [174.76008, -36.84994],
                suggestedRoute.coordinates[1]!,
              ],
            },
          },
          accessConditions: ["none_of_these"],
          nearbyFeatures: ["none_of_these"],
        },
        routePolicyVersion: 1,
        suggestedRoute,
      }),
    });
    expect(reportMapLegend(report).entries).toContainEqual(
      expect.objectContaining({
        id: "suggested-access-route",
        label: "Route supplied by user — confirm onsite",
      }),
    );
  });

  it.each(["blocked", "needs_checking", "no_warning"] as const)(
    "matches the blue captured pool when the warning is %s",
    (warningState) => {
      const report = buildTestPreliminaryReport({
        warningState,
        mapImageSource: "fast_property_view_capture",
      });
      expect(
        reportMapLegend(report).entries.find(
          (entry) => entry.id === "selected-pool",
        )?.colour,
      ).toBe("#2563eb");
    },
  );
});

describe("reportWarningLabel", () => {
  it("uses homeowner-safe wording for a position that needs review", () => {
    expect(reportWarningLabel("blocked")).toBe(
      "This pool position needs review",
    );
  });
});

describe("reportExcavationGeometry", () => {
  it("presents saved values as disclosed geometry scenarios rather than a range", () => {
    const report = buildTestPreliminaryReport({
      constructability: buildConstructabilitySnapshot({
        answers: {
          version: 1,
          estimatedDepthMetres: 1.5,
          route: { provenance: "uncertain", geometry: null },
          accessConditions: ["none_of_these"],
          nearbyFeatures: ["none_of_these"],
        },
        excavation: {
          dimensions: { lengthMetres: 6, widthMetres: 3 },
          terrainAdjustment: "unavailable",
        },
      }),
    });

    expect(reportExcavationGeometry(report)).toEqual({
      heading: "Illustrative excavation geometry",
      scenarios: [
        {
          id: "pool-outline",
          label: "Selected pool outline",
          valueCubicMetres: 27,
          formattedValue: "27.00 m³",
        },
        {
          id: "300mm-side-allowance",
          label: "300 mm side-allowance scenario",
          valueCubicMetres: 35.64,
          formattedValue: "35.64 m³",
        },
      ],
      assumptionId: "firth-masonry-side-300mm-v1",
      sourceUrl:
        "https://www.firth.co.nz/assets/Uploads/Resources/Documents/FIR0744-Masonry-Swimming-Pools.pdf",
      assumptionDisclosure: expect.stringMatching(
        /300 mm added on each side.*outside masonry wall.*temporary PoolReady proxy/i,
      ),
      rangeDisclosure: expect.stringMatching(
        /geometry scenarios.*not an upper bound.*actual excavation/i,
      ),
      exclusions: expect.stringMatching(
        /extra base depth.*masonry wall and footing dimensions.*floor falls.*drainage.*terrain cut.*battering or support.*services.*installation method.*not modelled/i,
      ),
      terrainStatus: "not_fully_assessed",
      terrainStatusLabel: "Not fully assessed",
      terrainLabel:
        "Base geometry estimate only — terrain adjustment unavailable",
      specialistDepthWarning: null,
    });
  });

  it("keeps the specialist-depth warning and treats available terrain separately", () => {
    const report = buildTestPreliminaryReport({
      constructability: buildConstructabilitySnapshot({
        answers: {
          version: 1,
          estimatedDepthMetres: 1.9,
          route: { provenance: "uncertain", geometry: null },
          accessConditions: ["none_of_these"],
          nearbyFeatures: ["none_of_these"],
        },
        excavation: {
          dimensions: { lengthMetres: 6, widthMetres: 3 },
          terrainAdjustment: "available_separate",
        },
      }),
    });

    expect(reportExcavationGeometry(report)).toMatchObject({
      terrainStatus: "available_separate",
      terrainStatusLabel: null,
      terrainLabel:
        "Terrain information is considered separately and is not added to these geometry scenarios.",
      specialistDepthWarning:
        "Specialist depth — professional confirmation required",
    });
  });
});
