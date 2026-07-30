import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  AssessmentSnapshotValidationError,
  createAssessmentSnapshotService,
} from "@/modules/assessment/assessment-snapshot";

const signingKey = "test-assessment-snapshot-signing-key-32-bytes";

function fastResult() {
  return {
    requestedAddress: "1 Test Street, Auckland",
    resolvedAddress: {
      addressId: "linz-123",
      fullAddress: "1 Test Street, Auckland",
      fullAddressNumber: "1 Test Street",
      unit: null,
      territorialAuthority: "Auckland",
      coordinates: [174.76, -36.85] as [number, number],
    },
    boundary: {
      state: "provisional" as const,
      geometry: null,
      areaSquareMetres: null,
      parcelId: null,
    },
    aerial: {
      state: "unavailable" as const,
      durationMs: null,
      attribution: null,
    },
    datasets: { legal_parcel: null, aerial_imagery: null },
    defaultPool: {
      id: "compact" as const,
      label: "Compact",
      lengthMetres: 6.5,
      widthMetres: 3,
    },
    progress: {
      address: "found" as const,
      boundary: "provisional" as const,
      aerial: "unavailable" as const,
      detailedChecks: "not_loaded" as const,
    },
    firstUsableViewStartedAt: "2026-07-30T00:00:00.000Z",
    fastPathDurationMs: 10,
  };
}

describe("assessment snapshots", () => {
  it("rejects a modified snapshot payload", () => {
    const service = createAssessmentSnapshotService(signingKey);
    const [payload, signature] = service.issue(fastResult()).split(".");
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    parsed.fastResult.resolvedAddress.fullAddress = "Altered address";
    const modifiedPayload = Buffer.from(
      JSON.stringify(parsed),
      "utf8",
    ).toString("base64url");

    expect(() => service.verify(`${modifiedPayload}.${signature}`)).toThrow(
      AssessmentSnapshotValidationError,
    );
  });

  it("rejects an expired snapshot", () => {
    let now = 0;
    const service = createAssessmentSnapshotService(signingKey, () => now);
    const token = service.issue(fastResult());
    now = 15 * 60 * 1_000;

    expect(() => service.verify(token)).toThrow(
      AssessmentSnapshotValidationError,
    );
  });
});
