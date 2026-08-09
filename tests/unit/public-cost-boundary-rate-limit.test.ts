import { afterEach, describe, expect, it, vi } from "vitest";

const launchBrowser = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("puppeteer-core", () => ({
  default: {
    defaultArgs: vi.fn(({ args }: { args: string[] }) => args),
    launch: launchBrowser,
  },
}));
vi.mock("@sparticuz/chromium", () => ({
  default: {
    args: ["--disable-dev-shm-usage"],
    executablePath: vi.fn(async () => "/opt/chromium"),
  },
}));

import { POST as addressSuggestions } from "@/app/api/public/address-suggestions/route";
import { POST as aerialConflicts } from "@/app/api/public/aerial-conflicts/route";
import { GET as aerialTile } from "@/app/api/public/aerial/tiles/[z]/[x]/[y]/route";
import { POST as reportPdf } from "@/app/api/public/report/pdf/route";
import { buildSessionAssessment } from "@/modules/assessment/build-session-assessment";
import { runDataAccessSpike } from "@/modules/data-access-spike/run-data-access-spike";
import { issueSessionReportToken } from "@/modules/reporting/report-token";
import { createDataAccessGateway } from "../fixtures/normalized-data-access";
import { TEST_MAP_IMAGE_DATA_URL } from "../fixtures/preliminary-report";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function productionRequest(path: string, body: unknown) {
  return new Request(`https://pool.example${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-vercel-forwarded-for": "203.0.113.10",
    },
    body: JSON.stringify(body),
  });
}

describe("public costly-route rate limits", () => {
  it("fails closed before address-suggestion provider work", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const providerFetch = vi.fn(async () => {
      throw new Error("provider should not be called");
    });
    vi.stubGlobal("fetch", providerFetch);

    const response = await addressSuggestions(
      productionRequest("/api/public/address-suggestions", {
        query: "42 Bahari Drive",
      }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: {
        code: "TEMPORARILY_UNAVAILABLE",
        message: "Please try again shortly.",
      },
    });
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it("fails closed before aerial-conflict analysis", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    const response = await aerialConflicts(
      productionRequest("/api/public/aerial-conflicts", {
        candidate: {
          id: "candidate-1",
          envelope: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [174.76, -36.85],
                  [174.761, -36.85],
                  [174.76, -36.85],
                ],
              ],
            },
          },
          dimensions: { lengthMetres: 6, widthMetres: 3 },
          rotationDegrees: 0,
        },
        context: {
          status: "unavailable",
          alignment: "unavailable",
          resolution: "unavailable",
          evidenceId: "aerial-unavailable",
        },
      }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: {
        code: "TEMPORARILY_UNAVAILABLE",
        message: "Please try again shortly.",
      },
    });
  });

  it("fails closed before direct PDF rendering", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.stubEnv(
      "INTERNAL_REPORT_SIGNING_SECRET",
      "controlled-report-signing-secret-1234567890",
    );
    launchBrowser.mockRejectedValue(new Error("browser should not launch"));
    const result = await runDataAccessSpike({
      requestedAddress: "42A Bahari Drive, Ranui, Auckland",
      gateway: createDataAccessGateway(),
      now: () => new Date("2026-07-20T01:02:03.000Z"),
    });

    const response = await reportPdf(
      productionRequest("/api/public/report/pdf", {
        reportToken: issueSessionReportToken(buildSessionAssessment(result)),
        mapImageDataUrl: TEST_MAP_IMAGE_DATA_URL,
      }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: {
        code: "TEMPORARILY_UNAVAILABLE",
        message: "Please try again shortly.",
      },
    });
    expect(launchBrowser).not.toHaveBeenCalled();
  });

  it("fails closed before aerial-tile provider work", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.stubEnv("LINZ_BASEMAPS_API_KEY", "test-linz-key");
    const providerFetch = vi.fn(async () => {
      throw new Error("provider should not be called");
    });
    vi.stubGlobal("fetch", providerFetch);

    const response = await aerialTile(
      new Request(
        "https://pool.example/api/public/aerial/tiles/18/258210/160518",
        { headers: { "x-vercel-forwarded-for": "203.0.113.10" } },
      ),
      { params: Promise.resolve({ z: "18", x: "258210", y: "160518" }) },
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: {
        code: "TEMPORARILY_UNAVAILABLE",
        message: "Please try again shortly.",
      },
    });
    expect(providerFetch).not.toHaveBeenCalled();
  });
});
