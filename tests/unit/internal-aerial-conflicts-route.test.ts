import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/internal/aerial-conflicts/route";

vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const envelope = {
  type: "Feature" as const,
  properties: {},
  geometry: {
    type: "Polygon" as const,
    coordinates: [
      [
        [174, -36],
        [174.001, -36],
        [174.001, -36.001],
        [174, -36.001],
        [174, -36],
      ],
    ],
  },
};

describe("POST /api/internal/aerial-conflicts", () => {
  it("keeps provider credentials server-side and invokes the bounded provider seam", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "server-only-test-key");
    vi.stubEnv("OPENAI_MODEL", "test-model");
    const fetchStub = vi.fn<typeof fetch>(async () =>
      Response.json({
        status: "completed",
        output: [
          {
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  findings: [
                    {
                      type: "vegetation_obstruction",
                      confidence: "low",
                      explanation: "Visible vegetation requires inspection.",
                      evidenceStatus: "possible",
                      inspectionRequirement: "required",
                    },
                  ],
                }),
              },
            ],
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchStub);

    const response = await POST(
      new Request("http://127.0.0.1:3000/api/internal/aerial-conflicts", {
        method: "POST",
        body: JSON.stringify({
          candidate: {
            id: "assisted-1",
            envelope,
            dimensions: { lengthMetres: 6, widthMetres: 3 },
            rotationDegrees: 0,
          },
          context: {
            status: "available",
            alignment: "aligned",
            resolution: "sufficient",
            evidenceId: "aerial:test",
            image: {
              dataUrl: "data:image/png;base64,AAAA",
              mediaType: "image/png",
            },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      source: "provider",
      candidateId: "assisted-1",
    });
    expect(fetchStub).toHaveBeenCalledOnce();
  });

  it("returns an explicit fallback when imagery is unavailable", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "server-only-test-key");
    const fetchStub = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchStub);

    const response = await POST(
      new Request("http://127.0.0.1:3000/api/internal/aerial-conflicts", {
        method: "POST",
        body: JSON.stringify({
          candidate: {
            id: "assisted-1",
            envelope,
            dimensions: { lengthMetres: 6, widthMetres: 3 },
            rotationDegrees: 0,
          },
          context: {
            status: "unavailable",
            alignment: "unavailable",
            resolution: "unavailable",
            evidenceId: "aerial:test",
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.source).toBe("fallback");
    expect(body.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ inspectionRequirement: "required" }),
      ]),
    );
    expect(fetchStub).not.toHaveBeenCalled();
  });
});
