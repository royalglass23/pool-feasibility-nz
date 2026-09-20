import { describe, expect, it } from "vitest";
import {
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
