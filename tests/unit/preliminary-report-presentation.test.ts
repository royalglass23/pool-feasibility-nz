import { describe, expect, it } from "vitest";
import {
  reportConstructabilitySections,
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

describe("reportConstructabilitySections", () => {
  it("builds the three conservative sections from the saved submission evidence", () => {
    const route = {
      type: "LineString" as const,
      coordinates: [
        [174.76, -36.85],
        [174.76015, -36.8499],
      ] as [number, number][],
    };
    const report = buildTestPreliminaryReport({
      constructability: buildConstructabilitySnapshot({
        answers: {
          version: 1,
          estimatedDepthMetres: 1.9,
          route: { provenance: "confirmed", geometry: route },
          accessConditions: ["rocky_ground"],
          nearbyFeatures: ["fences", "doors_or_windows"],
        },
        suggestedRoute: route,
        routePolicyVersion: 1,
        routeFacts: {
          valid: true,
          length: { status: "assessed", value: 18.4 },
          elevationChange: {
            status: "not_assessed",
            reason: "data_unavailable",
          },
          steepestGradient: {
            status: "not_assessed",
            reason: "data_unavailable",
          },
          parcelDeparture: { status: "assessed", value: false },
          buildings: { status: "assessed", value: false },
          services: { status: "not_assessed", reason: "data_unavailable" },
        },
        mappedEvidence: [
          {
            id: "saved-ground-check",
            category: "terrain_ground",
            status: "no_concern",
            provider: "Auckland DEM",
            dataset: "Indicative terrain",
          },
          {
            id: "saved-barrier-check",
            category: "barrier",
            status: "concern",
            provider: "Saved placement",
            dataset: "Nearby features",
          },
        ],
        providerAvailability: [
          {
            category: "terrain_ground",
            provider: "Auckland DEM",
            dataset: "Indicative terrain",
            status: "available",
          },
          {
            category: "barrier",
            provider: "Auckland Council",
            dataset: "Barrier evidence",
            status: "available",
          },
          {
            category: "access_excavation",
            provider: "Vector",
            dataset: "Mapped services",
            status: "error",
          },
        ],
        assumptions: ["Route policy v1 retained from the saved assessment."],
        excavation: {
          dimensions: { lengthMetres: 6, widthMetres: 3 },
          terrainAdjustment: "unavailable",
        },
      }),
    });

    const sections = reportConstructabilitySections(report);

    expect(sections.map((section) => section.title)).toEqual([
      "Terrain and ground conditions",
      "Pool barrier feasibility",
      "Excavation and construction access",
    ]);
    expect(sections.map((section) => section.statusLabel)).toEqual([
      "Needs checking",
      "Needs checking",
      "Needs checking",
    ]);
    expect(sections[0]).toMatchObject({
      evidence: expect.arrayContaining([
        expect.objectContaining({
          provenance: "Mapped evidence",
          description: expect.stringContaining("Auckland DEM"),
        }),
        expect.objectContaining({
          provenance: "Your Site answer",
          description: "Apparently rocky ground",
        }),
      ]),
      provenanceNote: expect.stringMatching(
        /both retained.*neither source clears the other/i,
      ),
    });
    expect(sections[1]).toMatchObject({
      boundary: expect.stringMatching(
        /does not propose a barrier.*compliance/i,
      ),
      evidence: expect.arrayContaining([
        expect.objectContaining({
          provenance: "Your Site answer",
          description: "Fences; Doors or windows",
        }),
      ]),
    });
    expect(sections[2]).toMatchObject({
      details: expect.arrayContaining([
        { label: "Estimated pool depth", value: "1.90 m" },
        { label: "Saved route", value: "Confirmed suggested route" },
        { label: "Route length", value: "18.4 m" },
      ]),
      excavation: expect.objectContaining({
        assumptionId: "firth-masonry-side-300mm-v1",
        specialistDepthWarning:
          "Specialist depth — professional confirmation required",
        terrainLabel:
          "Base geometry estimate only — terrain adjustment unavailable",
      }),
      evidence: expect.arrayContaining([
        expect.objectContaining({
          provenance: "Provider availability",
          description: "Vector — Mapped services: provider error",
        }),
      ]),
    });
  });

  it("keeps older reports accessible while marking every new section not fully assessed", () => {
    const sections = reportConstructabilitySections(
      buildTestPreliminaryReport(),
    );

    expect(sections).toHaveLength(3);
    expect(
      sections.every((section) => section.status === "not_fully_assessed"),
    ).toBe(true);
    expect(
      sections.every((section) => section.statusLabel === "Not fully assessed"),
    ).toBe(true);
  });
});
