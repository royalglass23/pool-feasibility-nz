import { describe, expect, it, vi } from "vitest";
import {
  getHomeownerAssessmentById,
  listHomeownerAssessments,
} from "@/db/repositories/homeowner-assessment-repository";
import { projectStaffConstructabilityEvidence } from "@/modules/staff/staff-assessment-read-model";
import { buildConstructabilitySnapshot } from "@/modules/assessment/constructability-evidence";
import { savedConstructabilitySnapshot } from "../fixtures/staff-assessment";

function assessmentRow(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id: "assessment-1",
    reference: "GF-2026-000001",
    status: "new_enquiry",
    homeownerName: "Jane Homeowner",
    homeownerPhone: "021 555 1234",
    homeownerEmail: "jane@example.com",
    homeownerAddress: "1 Test Street, Auckland",
    visitorType: "pool_builder",
    visitorTypeOtherDetail: null,
    desiredTiming: "3_months",
    desiredTimingOtherDetail: null,
    additionalInfo: null,
    boundaryStatus: "provisional",
    feasibilityState: "needs_checking",
    emailDeliveryState: "sent",
    forwardingState: "pending",
    createdAt: new Date("2026-07-29T01:00:00.000Z"),
    archivedAt: null,
    addressEvidence: {
      selectedAddressId: "linz-123",
      formattedAddress: "1 Test Street, Auckland",
      latitude: -36.85,
      longitude: 174.76,
      boundaryStatus: "provisional",
    },
    poolLayout: {
      lengthMetres: 6.5,
      widthMetres: 3,
      rotationDegrees: 24,
      position: [174.76, -36.85],
      shellGeometry: { type: "Polygon", coordinates: [] },
      constructionEnvelopeGeometry: { type: "Polygon", coordinates: [] },
    },
    layerStates: [
      { provider: "LINZ", dataset: "Building outlines", status: "empty" },
    ],
    warnings: [],
    recommendations: [],
    reportData: {
      recommendation: "Confirm the boundary.",
      preliminaryFeasibilityWording: "Preliminary only.",
      risks: [],
      actions: [],
      missingInformation: [],
      limitations: [],
      provenance: { datasets: [] },
    },
    ...overrides,
  };
}

describe("staff assessment read model", () => {
  it("projects complete saved constructability evidence without recalculating it", () => {
    const evidence = projectStaffConstructabilityEvidence(
      savedConstructabilitySnapshot,
    );

    expect(evidence).toMatchObject({
      status: "captured",
      estimatedDepth: "1.70 m",
      overallStatus: {
        value: savedConstructabilitySnapshot.overallStatus,
        label: "Not fully assessed",
      },
      siteAnswers: {
        accessConditions: ["Gate or narrow passage"],
        nearbyFeatures: ["I’m not sure"],
      },
      route: {
        response: "Confirmed suggested route",
        provenance: "confirmed",
        points: [
          { label: "Start", coordinate: "174.759800, -36.850200" },
          { label: "Pool area", coordinate: "174.760000, -36.850000" },
        ],
      },
      routeFacts: expect.arrayContaining([
        { label: "Approximate length", value: "18.4 m" },
        {
          label: "Elevation change",
          value: "Not assessed — data unavailable",
        },
        { label: "Mapped building intersection", value: "Identified" },
      ]),
      excavation: {
        status: "captured",
        scenarios: [
          { label: "Selected pool outline", value: "33.15 m³" },
          {
            label: "300 mm selected side-clearance scenario",
            value: "43.45 m³",
          },
        ],
        terrain: "Base geometry estimate only — terrain adjustment unavailable",
      },
      providerAvailability: expect.arrayContaining([
        expect.objectContaining({ status: "Available when assessed" }),
        expect.objectContaining({ status: "Not assessed — provider error" }),
      ]),
      mappedEvidence: expect.arrayContaining([
        expect.objectContaining({ status: "Potential site consideration" }),
        expect.objectContaining({ status: "Not assessed — data unavailable" }),
      ]),
      userEvidence: expect.arrayContaining([
        expect.objectContaining({ evidence: "Gate or narrow passage" }),
      ]),
    });
  });

  it("projects historical reports as explicitly not assessed", () => {
    expect(
      projectStaffConstructabilityEvidence({
        version: 0,
        status: "not_assessed",
        reason: "Site constructability evidence was not captured.",
      }),
    ).toEqual({
      status: "not_assessed",
      reason: "Site constructability evidence was not captured.",
    });
  });

  it("keeps section Not assessed distinct and exposes adjusted route geometry", () => {
    const suggestedRoute = {
      type: "LineString" as const,
      coordinates: [
        [174.7598, -36.8502],
        [174.76, -36.85],
      ] as [number, number][],
    };
    const adjustedRoute = {
      type: "LineString" as const,
      coordinates: [
        [174.7598, -36.8502],
        [174.7599, -36.8501],
        [174.76, -36.85],
      ] as [number, number][],
    };
    const snapshot = buildConstructabilitySnapshot({
      answers: {
        version: 1,
        estimatedDepthMetres: 1.5,
        route: { provenance: "user-supplied", geometry: adjustedRoute },
        accessConditions: ["not_sure"],
        nearbyFeatures: ["not_sure"],
      },
      suggestedRoute,
      routePolicyVersion: 1,
    });

    expect(projectStaffConstructabilityEvidence(snapshot)).toMatchObject({
      status: "captured",
      sectionStatus: { value: "not_assessed", label: "Not assessed" },
      route: {
        response: "Route supplied by user — confirm onsite",
        provenance: "user-supplied",
        points: [
          { label: "Start", coordinate: "174.759800, -36.850200" },
          {
            label: "Turning point 1",
            coordinate: "174.759900, -36.850100",
          },
          { label: "Pool area", coordinate: "174.760000, -36.850000" },
        ],
      },
    });
  });

  it("returns active dashboard entries newest first", async () => {
    const findMany = vi.fn().mockResolvedValue([
      assessmentRow({
        id: "newer",
        reference: "GF-2026-000003",
        createdAt: new Date("2026-07-29T02:00:00.000Z"),
      }),
      assessmentRow({
        id: "older",
        reference: "GF-2026-000001",
        createdAt: new Date("2026-07-28T01:00:00.000Z"),
      }),
    ]);
    const db = {
      query: { homeownerAssessments: { findMany } },
    } as unknown as Parameters<typeof listHomeownerAssessments>[0];

    const entries = await listHomeownerAssessments(db);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.anything(),
        orderBy: expect.any(Array),
      }),
    );
    expect(entries.map(({ id }) => id)).toEqual(["newer", "older"]);
    expect(entries[0]).toEqual({
      id: "newer",
      reference: "GF-2026-000003",
      homeownerName: "Jane Homeowner",
      homeownerPhone: "021 555 1234",
      homeownerAddress: "1 Test Street, Auckland",
      desiredTiming: "3_months",
      feasibilityState: "needs_checking",
      createdAt: new Date("2026-07-29T02:00:00.000Z"),
      poolLayout: {
        lengthMetres: 6.5,
        widthMetres: 3,
        rotationDegrees: 24,
      },
      evidenceCount: 1,
    });
  });

  it("returns only the active staff detail fields by id and hides archived records", async () => {
    const saved = assessmentRow({
      idempotencyKey: "submission-private-key",
      warnings: [
        {
          state: "blocked",
          code: "SERVICE_CONFLICT",
          title: "Mapped service conflict",
          message: "The saved pool intersects a mapped service.",
        },
      ],
      recommendations: [
        {
          phase: "before_concept_design",
          priority: 1,
          title: "Move the pool",
          reason: "The saved layout intersects a mapped service.",
        },
      ],
      layerStates: [
        {
          provider: "Auckland Council",
          dataset: "Wastewater assets",
          status: "returned",
        },
      ],
    });
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(saved)
      .mockResolvedValueOnce(
        assessmentRow({
          id: "archived",
          archivedAt: new Date("2026-07-29T03:00:00.000Z"),
        }),
      );
    const db = {
      query: { homeownerAssessments: { findFirst } },
    } as unknown as Parameters<typeof getHomeownerAssessmentById>[0];

    const active = await getHomeownerAssessmentById(db, "assessment-1");
    expect(active).toMatchObject({
      id: "assessment-1",
      homeownerName: "Jane Homeowner",
      homeownerEmail: "jane@example.com",
      visitorType: "pool_builder",
      feasibilityState: "needs_checking",
      emailDeliveryState: "sent",
      forwardingState: "pending",
    });
    expect(active).not.toHaveProperty("idempotencyKey");
    expect(active).not.toHaveProperty("poolLayout");
    expect(active).not.toHaveProperty("warnings");
    expect(active).not.toHaveProperty("reportData");
    await expect(
      getHomeownerAssessmentById(db, "archived"),
    ).resolves.toBeNull();
  });

  it("keeps a legacy assessment readable without inventing a visitor type", async () => {
    const findFirst = vi.fn().mockResolvedValue(
      assessmentRow({
        visitorType: null,
        visitorTypeOtherDetail: null,
        desiredTimingOtherDetail: null,
      }),
    );
    const db = {
      query: { homeownerAssessments: { findFirst } },
    } as unknown as Parameters<typeof getHomeownerAssessmentById>[0];

    await expect(
      getHomeownerAssessmentById(db, "assessment-1"),
    ).resolves.toMatchObject({
      visitorType: null,
      visitorTypeOtherDetail: null,
      reportAudience: "homeowner",
      desiredTimingOtherDetail: null,
    });
  });

  it("exposes the persisted report audience independently of legacy visitor display state", async () => {
    const row = assessmentRow({ visitorType: "homeowner" });
    row.reportData = {
      ...(row.reportData as Record<string, unknown>),
      reportAudience: "pool_builder",
    };
    const findFirst = vi.fn().mockResolvedValue(row);
    const db = {
      query: { homeownerAssessments: { findFirst } },
    } as unknown as Parameters<typeof getHomeownerAssessmentById>[0];

    await expect(
      getHomeownerAssessmentById(db, "assessment-1"),
    ).resolves.toMatchObject({
      visitorType: "homeowner",
      reportAudience: "pool_builder",
    });
  });
});
