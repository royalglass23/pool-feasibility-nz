import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  AssessmentSnapshotValidationError,
  createAssessmentSnapshotService,
} from "@/modules/assessment/assessment-snapshot";
import { officialDatasetEvidence } from "@/modules/providers/official-dataset-catalog";

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
    datasets: {
      address_resolution: officialDatasetEvidence(
        "address_resolution",
        "2026-07-30T00:00:00.000Z",
      ),
      legal_parcel: null,
      aerial_imagery: null,
    },
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
  const compactLayout = {
    layoutId: "compact" as const,
    layoutName: "Compact" as const,
    lengthMetres: 6.5 as const,
    widthMetres: 3 as const,
  };

  it("signs and verifies the selected named pool layout", () => {
    const service = createAssessmentSnapshotService(signingKey);
    const initial = service.verify(service.issue(fastResult()));
    const token = service.attachReportAudience(
      initial,
      "homeowner",
      compactLayout,
    );

    expect(service.verify(token).poolLayout).toEqual(compactLayout);
  });

  it("rejects a conflicting layout rebind even when the dimensions match", () => {
    const service = createAssessmentSnapshotService(signingKey);
    const initial = service.verify(service.issue(fastResult()));
    const bound = service.verify(
      service.attachReportAudience(initial, "homeowner", compactLayout),
    );

    expect(() =>
      service.attachReportAudience(bound, "homeowner", {
        layoutId: "custom",
        layoutName: "Custom",
        lengthMetres: 6.5,
        widthMetres: 3,
      }),
    ).toThrow(AssessmentSnapshotValidationError);
  });

  it("rejects a correctly signed but incompatible layout contract", () => {
    const service = createAssessmentSnapshotService(signingKey);
    const [payload] = service.issue(fastResult()).split(".");
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    parsed.poolLayout = {
      layoutId: "compact",
      layoutName: "Custom",
      lengthMetres: 6.5,
      widthMetres: 3,
    };
    const incompatiblePayload = Buffer.from(
      JSON.stringify(parsed),
      "utf8",
    ).toString("base64url");
    const signature = createHmac("sha256", signingKey)
      .update(incompatiblePayload)
      .digest("base64url");

    expect(() => service.verify(`${incompatiblePayload}.${signature}`)).toThrow(
      AssessmentSnapshotValidationError,
    );
  });

  it("continues to verify historical snapshots without layout metadata", () => {
    const service = createAssessmentSnapshotService(signingKey);

    expect(
      service.verify(service.issue(fastResult())).poolLayout,
    ).toBeUndefined();
  });

  it("signs and verifies the selected report audience", () => {
    const service = createAssessmentSnapshotService(signingKey);
    const initial = service.verify(service.issue(fastResult()));
    const token = service.attachReportAudience(initial, "pool_builder");

    expect(service.verify(token).reportAudience).toBe("pool_builder");
    expect(service.verify(token).submissionId).toBe(initial.submissionId);
    expect(service.attachReportAudience(initial, "pool_builder")).toBe(token);
  });

  it("rejects a report audience changed after signing", () => {
    const service = createAssessmentSnapshotService(signingKey);
    const initial = service.verify(service.issue(fastResult()));
    const [payload, signature] = service
      .attachReportAudience(initial, "homeowner")
      .split(".");
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    parsed.reportAudience = "pool_builder";
    const modifiedPayload = Buffer.from(
      JSON.stringify(parsed),
      "utf8",
    ).toString("base64url");

    expect(() => service.verify(`${modifiedPayload}.${signature}`)).toThrow(
      AssessmentSnapshotValidationError,
    );
  });

  it("allows an idempotent audience reissue but rejects a conflicting rebind", () => {
    const service = createAssessmentSnapshotService(signingKey);
    const initial = service.verify(service.issue(fastResult()));
    const homeownerToken = service.attachReportAudience(initial, "homeowner");
    const bound = service.verify(homeownerToken);

    expect(service.attachReportAudience(bound, "homeowner")).toBe(
      homeownerToken,
    );
    expect(() => service.attachReportAudience(bound, "pool_builder")).toThrow(
      AssessmentSnapshotValidationError,
    );
  });

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
