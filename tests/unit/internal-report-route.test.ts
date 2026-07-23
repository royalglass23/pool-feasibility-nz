import { afterEach, describe, expect, it, vi } from "vitest";

const logInfo = vi.hoisted(() => vi.fn());
const launchBrowser = vi.hoisted(() => vi.fn());

const threePagePdf = Buffer.from(
  "%PDF-1.4\n/Type /Page\n/Type /Page\n/Type /Page\n%%EOF",
);

vi.mock("server-only", () => ({}));
vi.mock("pino", () => ({ default: () => ({ info: logInfo }) }));
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

import { POST } from "@/app/api/internal/report/pdf/route";
import { buildSessionAssessment } from "@/modules/assessment/build-session-assessment";
import { runDataAccessSpike } from "@/modules/data-access-spike/run-data-access-spike";
import { issueSessionReportToken } from "@/modules/reporting/report-token";
import { createDataAccessGateway } from "../fixtures/normalized-data-access";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("POST /api/internal/report/pdf security outcomes", () => {
  it("returns a three-page PDF without a Playwright browser cache", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("PLAYWRIGHT_BROWSERS_PATH", "missing-playwright-browser-cache");
    vi.stubEnv(
      "INTERNAL_REPORT_SIGNING_SECRET",
      "controlled-report-signing-secret-1234567890",
    );
    const page = {
      emulateMediaType: vi.fn(async () => undefined),
      on: vi.fn(),
      pdf: vi.fn(async () => new Uint8Array(threePagePdf)),
      setContent: vi.fn(async () => undefined),
      setRequestInterception: vi.fn(async () => undefined),
    };
    launchBrowser.mockResolvedValue({
      close: vi.fn(async () => undefined),
      newPage: vi.fn(async () => page),
    });
    const result = await runDataAccessSpike({
      requestedAddress: "42A Bahari Drive, Ranui, Auckland",
      gateway: createDataAccessGateway(),
      now: () => new Date("2026-07-20T01:02:03.000Z"),
    });

    const response = await POST(
      new Request("http://127.0.0.1:3000/api/internal/report/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportToken: issueSessionReportToken(buildSessionAssessment(result)),
          mapImageDataUrl:
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGL5//8/AAAA//+rxzhLAAAABklEQVQDAAYOAwJctCtXAAAAAElFTkSuQmCC",
        }),
      }),
    );
    const pdf = Buffer.from(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.toString("latin1").match(/\/Type \/Page/g)).toHaveLength(3);
  }, 30_000);

  it("logs a rejected outcome without submitted report content", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const submittedMarker = "sensitive-report-marker";

    const response = await POST(
      new Request("http://127.0.0.1:3000/api/internal/report/pdf", {
        method: "POST",
        headers: { "X-Correlation-ID": "report-security-log-test" },
        body: JSON.stringify({ submittedMarker }),
      }),
    );

    expect(response.status).toBe(400);
    expect(logInfo).toHaveBeenCalledWith({
      event: "pdf_report_security",
      outcome: "rejected",
      category: "invalid_request",
      principal: "local_development",
      status: 400,
      correlationId: "report-security-log-test",
      durationMs: expect.any(Number),
    });
    expect(JSON.stringify(logInfo.mock.calls)).not.toContain(submittedMarker);
  });
});
