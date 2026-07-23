import { describe, expect, it, vi } from "vitest";
import { OpenAiAerialImageryConflictProvider } from "@/modules/providers/openai-aerial-imagery-conflict-provider";

const candidate = {
  id: "candidate-1",
  envelope: {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "Polygon" as const,
      coordinates: [
        [
          [174.6, -36.8],
          [174.601, -36.8],
          [174.601, -36.799],
          [174.6, -36.799],
          [174.6, -36.8],
        ],
      ],
    },
  },
  dimensions: { lengthMetres: 8, widthMetres: 4 },
  rotationDegrees: 15,
};

const context = {
  status: "available" as const,
  alignment: "aligned" as const,
  resolution: "sufficient" as const,
  evidenceId: "linz-aerial",
  image: {
    dataUrl: "data:image/png;base64,ZmFrZQ==",
    mediaType: "image/png" as const,
  },
};

function response(output: unknown) {
  return Response.json({
    status: "completed",
    output: [
      { content: [{ type: "output_text", text: JSON.stringify(output) }] },
    ],
  });
}

describe("OpenAiAerialImageryConflictProvider", () => {
  it("sends only bounded candidate imagery context and anchors findings to the candidate", async () => {
    const fetchStub = vi.fn<typeof fetch>(async () =>
      response({
        findings: [
          {
            type: "possible_existing_pool",
            confidence: "medium",
            explanation: "Visible rectangular feature.",
            evidenceStatus: "possible",
            inspectionRequirement: "recommended",
          },
        ],
      }),
    );
    const provider = new OpenAiAerialImageryConflictProvider({
      apiKey: "test-key",
      model: "test-model",
      fetch: fetchStub,
    });
    const result = await provider.assess({
      candidate,
      context,
      signal: new AbortController().signal,
    });
    const body = JSON.parse(String(fetchStub.mock.calls[0][1]?.body));
    expect(body.input[0].content).toHaveLength(2);
    expect(body.input[0].content[0].text).not.toMatch(
      /candidate-1|session|address|parcel|apiKey/i,
    );
    expect(result).toEqual({
      findings: [expect.objectContaining({ affectedArea: candidate.envelope })],
    });
  });

  it("rejects malformed provider findings", async () => {
    const provider = new OpenAiAerialImageryConflictProvider({
      apiKey: "test-key",
      model: "test-model",
      fetch: vi.fn<typeof fetch>(async () =>
        response({ findings: [{ type: "parcel_identity" }] }),
      ),
    });
    await expect(
      provider.assess({
        candidate,
        context,
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow();
  });
});
