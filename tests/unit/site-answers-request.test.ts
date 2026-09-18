import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  issueAssessmentSnapshot,
  verifyAssessmentSnapshot,
} from "@/modules/assessment/assessment-snapshot";
import { handleSiteAnswersRequest } from "@/modules/assessment/handle-site-answers-request";
import type { FastPropertyViewResult } from "@/modules/data-access-spike/fast-property-view";

const fastResult = {
  resolvedAddress: {
    addressId: "linz-site-1",
    fullAddress: "1 Test Street, Auckland",
    coordinates: [174.76, -36.85],
  },
  boundary: { state: "confirmed" },
} as FastPropertyViewResult;

const answers = {
  accessConditions: ["gate_or_narrow_passage", "rocky_ground"],
  nearbyFeatures: ["fences", "doors_or_windows"],
};

function request(body: unknown) {
  return new Request(
    "http://localhost/api/public/assessment-snapshot/site-answers",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

describe("public Site answers boundary", () => {
  it("signs fixed user answers while preserving the original submission identity", async () => {
    const token = issueAssessmentSnapshot(fastResult);
    const original = verifyAssessmentSnapshot(token);
    const response = await handleSiteAnswersRequest(
      request({ assessmentSnapshot: token, ...answers }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    const signed = verifyAssessmentSnapshot(body.assessmentSnapshot);
    expect(signed.submissionId).toBe(original.submissionId);
    expect(signed.constructability?.answers).toMatchObject({
      version: 1,
      estimatedDepthMetres: 1.5,
      route: { provenance: "uncertain", geometry: null },
      ...answers,
    });
    expect(signed.constructability?.evidence.mappedEvidence).toEqual([]);
  });

  it("rejects exclusive answers mixed with conditions and invalid tokens", async () => {
    const token = issueAssessmentSnapshot(fastResult);
    const mixed = await handleSiteAnswersRequest(
      request({
        assessmentSnapshot: token,
        accessConditions: ["none_of_these", "rocky_ground"],
        nearbyFeatures: ["none_of_these"],
      }),
    );
    expect(mixed.status).toBe(400);
    const invalid = await handleSiteAnswersRequest(
      request({ assessmentSnapshot: "invalid", ...answers }),
    );
    expect(invalid.status).toBe(400);
  });

  it("retains trusted mapped evidence when the user selects None of these", async () => {
    const token = issueAssessmentSnapshot(fastResult, {
      answers: {
        version: 1,
        estimatedDepthMetres: 1.5,
        route: { provenance: "uncertain", geometry: null },
        accessConditions: ["not_sure"],
        nearbyFeatures: ["not_sure"],
      },
      evidence: {
        suggestedRoute: null,
        mappedEvidence: [
          {
            id: "mapped-retaining-wall",
            category: "access_excavation",
            status: "concern",
            provider: "official-map",
            dataset: "retaining-walls",
          },
        ],
        providerAvailability: [],
        assumptions: [],
      },
    });
    const response = await handleSiteAnswersRequest(
      request({
        assessmentSnapshot: token,
        accessConditions: ["none_of_these"],
        nearbyFeatures: ["none_of_these"],
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    const signed = verifyAssessmentSnapshot(body.assessmentSnapshot);
    expect(signed.constructability?.evidence.mappedEvidence).toEqual([
      {
        id: "mapped-retaining-wall",
        category: "access_excavation",
        status: "concern",
        provider: "official-map",
        dataset: "retaining-walls",
      },
    ]);
  });
});
