import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createAssessmentSnapshotService } from "@/modules/assessment/assessment-snapshot";
import { handleReportAudienceRequest } from "@/modules/assessment/handle-report-audience-request";
import { officialDatasetEvidence } from "@/modules/providers/official-dataset-catalog";

const service = createAssessmentSnapshotService(
  "test-assessment-snapshot-signing-key-32-bytes",
);

function assessmentSnapshot() {
  return service.issue({
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
      state: "provisional",
      geometry: null,
      areaSquareMetres: null,
      parcelId: null,
    },
    aerial: { state: "unavailable", durationMs: null, attribution: null },
    datasets: {
      address_resolution: officialDatasetEvidence(
        "address_resolution",
        "2026-09-23T00:00:00.000Z",
      ),
      legal_parcel: null,
      aerial_imagery: null,
    },
    defaultPool: {
      id: "compact",
      label: "Compact",
      lengthMetres: 6.5,
      widthMetres: 3,
    },
    progress: {
      address: "found",
      boundary: "provisional",
      aerial: "unavailable",
      detailedChecks: "not_loaded",
    },
    firstUsableViewStartedAt: "2026-09-23T00:00:00.000Z",
    fastPathDurationMs: 10,
  });
}

describe("report audience snapshot request", () => {
  it("returns a snapshot bound to the selected canonical audience", async () => {
    const response = await handleReportAudienceRequest(
      new Request("http://localhost/api/public/assessment-snapshot/audience", {
        method: "POST",
        body: JSON.stringify({
          assessmentSnapshot: assessmentSnapshot(),
          reportAudience: "pool_builder",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(service.verify(body.assessmentSnapshot).reportAudience).toBe(
      "pool_builder",
    );
  });

  it("rejects a non-canonical audience", async () => {
    const response = await handleReportAudienceRequest(
      new Request("http://localhost/api/public/assessment-snapshot/audience", {
        method: "POST",
        body: JSON.stringify({
          assessmentSnapshot: assessmentSnapshot(),
          reportAudience: "other",
        }),
      }),
    );

    expect(response.status).toBe(400);
  });
});
