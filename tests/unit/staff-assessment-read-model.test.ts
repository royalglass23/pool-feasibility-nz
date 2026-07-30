import { describe, expect, it, vi } from "vitest";
import {
  getHomeownerAssessmentById,
  listHomeownerAssessments,
} from "@/db/repositories/homeowner-assessment-repository";

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
    desiredTiming: "3_months",
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
});
