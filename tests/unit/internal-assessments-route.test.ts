import { afterEach, describe, expect, it, vi } from "vitest";
import { TEST_MAP_IMAGE_DATA_URL } from "../fixtures/preliminary-report";
import { createAssessmentSnapshotService } from "@/modules/assessment/assessment-snapshot";
import {
  buildServerAssessmentSubmission,
  parseBrowserAssessmentSaveRequest,
} from "@/modules/assessment/server-assessment-submission";

const getDb = vi.hoisted(() => vi.fn(() => ({}) as never));
const saveHomeownerAssessment = vi.hoisted(() => vi.fn());
const getSavedPreliminaryReportById = vi.hoisted(() => vi.fn());
const deliverAssessmentReportByReference = vi.hoisted(() => vi.fn());
const scheduledCallbacks = vi.hoisted(
  () => [] as Array<() => void | Promise<void>>,
);

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({
  after: (callback: () => void | Promise<void>) => {
    scheduledCallbacks.push(callback);
  },
}));
vi.mock("@/db/client", () => ({ getDb }));
vi.mock("@/db/repositories/homeowner-assessment-repository", () => ({
  getSavedPreliminaryReportById,
  saveHomeownerAssessment,
}));
vi.mock("@/modules/reporting/deliver-assessment-report", () => ({
  deliverAssessmentReportByReference,
}));

import { POST } from "@/app/api/internal/assessments/route";

const snapshotSigningKey = "test-assessment-snapshot-signing-key-32-bytes";
const snapshotService = createAssessmentSnapshotService(snapshotSigningKey);
const validSubmission = {
  assessmentSnapshot: snapshotService.issue({
    requestedAddress: "1 Test Street, Auckland",
    resolvedAddress: {
      addressId: "linz-123",
      fullAddress: "1 Test Street, Auckland",
      fullAddressNumber: "1 Test Street",
      unit: null,
      territorialAuthority: "Auckland",
      coordinates: [174.76, -36.85],
    },
    boundary: {
      state: "confirmed",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [174.75, -36.86],
            [174.77, -36.86],
            [174.77, -36.84],
            [174.75, -36.84],
            [174.75, -36.86],
          ],
        ],
      },
      areaSquareMetres: 900,
      parcelId: "parcel-123",
    },
    aerial: { state: "unavailable", durationMs: null, attribution: null },
    datasets: { legal_parcel: null, aerial_imagery: null },
    defaultPool: {
      id: "compact",
      label: "Compact",
      lengthMetres: 6.5,
      widthMetres: 3,
    },
    progress: {
      address: "found",
      boundary: "found",
      aerial: "unavailable",
      detailedChecks: "not_loaded",
    },
    firstUsableViewStartedAt: "2026-07-29T01:00:00.000Z",
    fastPathDurationMs: 10,
  }),
  homeowner: {
    name: "Jane Homeowner",
    phone: "021 555 1234",
    email: "jane@example.com",
    desiredTiming: "3_months",
    consentGiven: true,
  },
  poolLayout: {
    lengthMetres: 6.5,
    widthMetres: 3,
    rotationDegrees: 12,
    position: [174.76, -36.85],
  },
};

afterEach(() => {
  getDb.mockClear();
  saveHomeownerAssessment.mockReset();
  getSavedPreliminaryReportById.mockReset();
  deliverAssessmentReportByReference.mockReset();
  scheduledCallbacks.length = 0;
  vi.unstubAllEnvs();
});

describe("POST /api/internal/assessments", () => {
  it("builds canonical saved facts from the server snapshot", async () => {
    const request = parseBrowserAssessmentSaveRequest(validSubmission);
    const snapshot = snapshotService.verify(request.assessmentSnapshot);

    await expect(
      buildServerAssessmentSubmission({
        request,
        snapshot,
        now: () => new Date("2026-07-30T00:00:00.000Z"),
      }),
    ).resolves.toMatchObject({
      idempotencyKey: snapshot.submissionId,
      addressEvidence: { selectedAddressId: "linz-123" },
    });
  });

  it("rejects a pool position outside the signed property boundary", async () => {
    const request = parseBrowserAssessmentSaveRequest({
      ...validSubmission,
      poolLayout: { ...validSubmission.poolLayout, position: [174.7, -36.8] },
    });
    const snapshot = snapshotService.verify(request.assessmentSnapshot);

    await expect(
      buildServerAssessmentSubmission({ request, snapshot }),
    ).rejects.toThrow("INVALID_ASSESSMENT_SUBMISSION");
  });

  it("rejects non-loopback requests when internal access is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INTERNAL_ACCESS_USERNAME", "");
    vi.stubEnv("INTERNAL_ACCESS_PASSWORD", "");

    const response = await POST(
      new Request("https://pool.example/api/internal/assessments", {
        method: "POST",
        body: JSON.stringify(validSubmission),
      }),
    );

    expect(response.status).toBe(503);
    expect(saveHomeownerAssessment).not.toHaveBeenCalled();
  });

  it("rejects invalid submissions before opening the database", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("INTERNAL_REPORT_SIGNING_SECRET", snapshotSigningKey);

    const response = await POST(
      new Request("http://127.0.0.1:3000/api/internal/assessments", {
        method: "POST",
        body: JSON.stringify({ ...validSubmission, homeowner: {} }),
      }),
    );

    expect(response.status).toBe(400);
    expect(getDb).not.toHaveBeenCalled();
    expect(saveHomeownerAssessment).not.toHaveBeenCalled();
  });

  it("rejects browser-authored assessment facts without a server snapshot", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("INTERNAL_REPORT_SIGNING_SECRET", snapshotSigningKey);

    const response = await POST(
      new Request("http://127.0.0.1:3000/api/internal/assessments", {
        method: "POST",
        body: JSON.stringify({
          ...validSubmission,
          assessmentSnapshot: "not-a-server-snapshot",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(getDb).not.toHaveBeenCalled();
    expect(saveHomeownerAssessment).not.toHaveBeenCalled();
  });

  it("persists a validated server snapshot", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("INTERNAL_REPORT_SIGNING_SECRET", snapshotSigningKey);
    saveHomeownerAssessment.mockResolvedValue({
      assessment: {
        id: "assessment-1",
        reference: "GF-2026-000001",
        status: "new_enquiry",
        createdAt: new Date("2026-07-29T02:03:04.000Z"),
        emailDeliveryState: "pending",
        forwardingState: "pending",
      },
      created: true,
    });
    getSavedPreliminaryReportById.mockResolvedValue({
      reference: "GF-2026-000001",
      generatedAt: "2026-07-29T02:03:04.000Z",
      title: "Stored preliminary report",
      summary: "The original persisted assessment.",
      warningState: "blocked",
      property: {
        address: "Stored address",
        boundaryStatus: "confirmed",
        boundaryConfidence: "high",
        boundaryAreaSquareMetres: 900,
        parcelIdentifier: null,
      },
      pool: {
        lengthMetres: 6.5,
        widthMetres: 3,
        rotationDegrees: 12,
      },
      warnings: [],
      recommendations: [],
      layers: [],
      limitations: [],
      mapImageDataUrl: TEST_MAP_IMAGE_DATA_URL,
    });
    deliverAssessmentReportByReference.mockRejectedValue(
      new Error("email provider unavailable"),
    );

    const response = await POST(
      new Request("http://127.0.0.1:3000/api/internal/assessments", {
        method: "POST",
        headers: { "x-correlation-id": "mt-248-test" },
        body: JSON.stringify(validSubmission),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      assessment: {
        id: "assessment-1",
        reference: "GF-2026-000001",
        status: "new_enquiry",
        created: true,
        report: expect.objectContaining({
          reference: "GF-2026-000001",
          warningState: "blocked",
          summary: "The original persisted assessment.",
          mapImageDataUrl: TEST_MAP_IMAGE_DATA_URL,
        }),
        delivery: {
          homeowner: "pending",
          servicem8: "pending",
        },
      },
    });
    expect(response.headers.get("x-correlation-id")).toBe("mt-248-test");
    expect(saveHomeownerAssessment).toHaveBeenCalledOnce();
    expect(getSavedPreliminaryReportById).toHaveBeenCalledWith(
      expect.anything(),
      "assessment-1",
    );
    expect(saveHomeownerAssessment).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        idempotencyKey: expect.any(String),
      }),
    );
    expect(deliverAssessmentReportByReference).not.toHaveBeenCalled();
    expect(scheduledCallbacks).toHaveLength(1);

    await expect(scheduledCallbacks[0]()).resolves.toBeUndefined();

    expect(deliverAssessmentReportByReference).toHaveBeenCalledWith(
      "GF-2026-000001",
    );
  });

  it("rejects a replayed server snapshot", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("INTERNAL_REPORT_SIGNING_SECRET", snapshotSigningKey);
    saveHomeownerAssessment.mockResolvedValue({
      assessment: {
        id: "assessment-1",
        reference: "GF-2026-000001",
        status: "new_enquiry",
        emailDeliveryState: "pending",
        forwardingState: "pending",
      },
      created: false,
    });

    const response = await POST(
      new Request("http://127.0.0.1:3000/api/internal/assessments", {
        method: "POST",
        body: JSON.stringify(validSubmission),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ASSESSMENT_SNAPSHOT_ALREADY_USED" },
    });
    expect(getSavedPreliminaryReportById).not.toHaveBeenCalled();
    expect(deliverAssessmentReportByReference).not.toHaveBeenCalled();
  });
});
