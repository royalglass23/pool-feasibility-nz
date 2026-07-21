import { describe, expect, it, vi } from "vitest";
import { createDataAccessGateway } from "../fixtures/normalized-data-access";
import { executeAssessmentRequest } from "@/modules/assessment/execute-assessment-request";

describe("executeAssessmentRequest", () => {
  it("returns deterministic analysis with a grounded plain-language explanation", async () => {
    const logNarrativeOutcome = vi.fn();
    const response = await executeAssessmentRequest({
      body: { address: "42A Bahari Drive, Ranui, Auckland" },
      gateway: createDataAccessGateway(),
      narrativeProvider: {
        explain: async () => ({
          paragraphs: [
            {
              factIds: ["assessment:confidence"],
            },
          ],
        }),
      },
      now: () => new Date("2026-07-20T01:02:03.000Z"),
      logNarrativeOutcome,
    });

    expect(response).toMatchObject({
      ok: true,
      status: 200,
      data: {
        feasibilityAssessment: { confidence: { score: 42, level: "low" } },
        assessmentExplanation: {
          source: "ai",
          paragraphs: ["Deterministic confidence is low at 42 out of 100."],
        },
      },
    });
    expect(logNarrativeOutcome).toHaveBeenCalledWith({
      event: "assessment_narrative",
      outcome: "success",
    });
    expect(JSON.stringify(logNarrativeOutcome.mock.calls)).not.toMatch(
      /Bahari|OPENAI|apiKey|coordinates|geometry/i,
    );
  });

  it("logs a redacted fallback outcome when narrative generation fails", async () => {
    const logNarrativeOutcome = vi.fn();

    const response = await executeAssessmentRequest({
      body: { address: "42A Bahari Drive, Ranui, Auckland" },
      gateway: createDataAccessGateway(),
      narrativeProvider: {
        explain: async () => {
          throw new Error("OPENAI_API_KEY=secret for 42A Bahari Drive");
        },
      },
      logNarrativeOutcome,
      now: () => new Date("2026-07-20T01:02:03.000Z"),
    });

    expect(response).toMatchObject({
      ok: true,
      data: { assessmentExplanation: { source: "deterministic_fallback" } },
    });
    expect(logNarrativeOutcome).toHaveBeenCalledWith({
      event: "assessment_narrative",
      outcome: "fallback",
    });
    expect(JSON.stringify(logNarrativeOutcome.mock.calls)).not.toMatch(
      /secret|Bahari|OPENAI|apiKey|coordinates|geometry/i,
    );
  });
});
