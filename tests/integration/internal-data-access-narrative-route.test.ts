import { afterEach, describe, expect, it, vi } from "vitest";
import { createDataAccessGateway } from "../fixtures/normalized-data-access";
import { runDataAccessSpike } from "@/modules/data-access-spike/run-data-access-spike";

const executeDataAccessRequest = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/modules/data-access-spike/execute-data-access-request", () => ({
  executeDataAccessRequest,
}));

import { POST } from "@/app/api/internal/data-access/route";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("POST /api/internal/data-access narrative integration", () => {
  it("adds a constrained OpenAI explanation without changing deterministic results", async () => {
    const result = await runDataAccessSpike({
      requestedAddress: "42A Bahari Drive, Ranui, Auckland",
      gateway: createDataAccessGateway(),
      now: () => new Date("2026-07-20T01:02:03.000Z"),
    });
    executeDataAccessRequest.mockResolvedValue({
      ok: true,
      status: 200,
      data: result,
    });
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "server-only-test-key");
    vi.stubEnv("OPENAI_MODEL", "gpt-5.6-luna");
    const fetchStub = vi.fn<typeof fetch>(async () =>
      Response.json({
        status: "completed",
        output: [
          {
            type: "message",
            role: "assistant",
            content: [
              {
                type: "output_text",
                text: '{"paragraphs":[{"factIds":["assessment:confidence"]}]}',
              },
            ],
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchStub);

    const response = await POST(
      new Request("http://127.0.0.1:3000/api/internal/data-access", {
        method: "POST",
        body: JSON.stringify({
          address: "42A Bahari Drive, Ranui, Auckland",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.assessmentExplanation).toEqual({
      source: "ai",
      heading: "Constrained AI explanation",
      paragraphs: ["Deterministic confidence is low at 42 out of 100."],
    });
    expect(body.data.feasibilityAssessment).toEqual(
      result.feasibilityAssessment,
    );
    expect(body.data.scenarioComparison).toEqual(result.scenarioComparison);
    expect(fetchStub).toHaveBeenCalledOnce();
  });

  it("returns deterministic fallback wording without calling OpenAI when AI is disabled", async () => {
    const result = await runDataAccessSpike({
      requestedAddress: "42A Bahari Drive, Ranui, Auckland",
      gateway: createDataAccessGateway(),
      now: () => new Date("2026-07-20T01:02:03.000Z"),
    });
    executeDataAccessRequest.mockResolvedValue({
      ok: true,
      status: 200,
      data: result,
    });
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AI_PROVIDER", "none");
    vi.stubEnv("OPENAI_API_KEY", "");
    const fetchStub = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchStub);

    const response = await POST(
      new Request("http://127.0.0.1:3000/api/internal/data-access", {
        method: "POST",
        body: JSON.stringify({
          address: "42A Bahari Drive, Ranui, Auckland",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        feasibilityAssessment: result.feasibilityAssessment,
        assessmentExplanation: {
          source: "deterministic_fallback",
          heading: "Deterministic assessment explanation",
          paragraphs: [
            "Insufficient core data is available for a preliminary recommendation.",
            "Deterministic confidence is low at 42 out of 100.",
            "No pool shell size range was successfully placed with the available evidence.",
          ],
        },
      },
    });
    expect(fetchStub).not.toHaveBeenCalled();
  });
});
