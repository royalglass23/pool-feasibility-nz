import { afterEach, describe, expect, it, vi } from "vitest";
import { buildTestPreliminaryReport } from "../fixtures/preliminary-report";

const getDb = vi.hoisted(() => vi.fn(() => ({}) as never));
const getSavedPreliminaryReportById = vi.hoisted(() => vi.fn());
const generatePreliminaryReportPdf = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () => ({ getDb }));
vi.mock("@/db/repositories/homeowner-assessment-repository", () => ({
  getSavedPreliminaryReportById,
}));
vi.mock("@/modules/reporting/report-renderer", () => ({
  generatePreliminaryReportPdf,
}));

import { GET } from "@/app/api/internal/assessments/[id]/report/route";

const ASSESSMENT_ID = "d6bfe050-bd85-4682-8f16-7c3ca4fd4c48";

const report = buildTestPreliminaryReport({ warnings: [] });

afterEach(() => {
  getDb.mockClear();
  getSavedPreliminaryReportById.mockReset();
  generatePreliminaryReportPdf.mockReset();
  vi.unstubAllEnvs();
});

describe("GET saved preliminary report PDF", () => {
  it("rejects an invalid reference before opening the database", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const response = await GET(
      new Request(
        "http://127.0.0.1:3000/api/internal/assessments/not-valid/report",
      ),
      { params: Promise.resolve({ id: "not-valid" }) },
    );

    expect(response.status).toBe(400);
    expect(getDb).not.toHaveBeenCalled();
  });

  it("returns the PDF generated from the persisted shared report", async () => {
    vi.stubEnv("NODE_ENV", "development");
    getSavedPreliminaryReportById.mockResolvedValue(report);
    generatePreliminaryReportPdf.mockResolvedValue(
      Buffer.from("%PDF-persisted"),
    );

    const response = await GET(
      new Request(
        `http://127.0.0.1:3000/api/internal/assessments/${ASSESSMENT_ID}/report`,
        { headers: { "x-correlation-id": "mt-249-pdf" } },
      ),
      { params: Promise.resolve({ id: ASSESSMENT_ID }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain(
      "pool-feasibility-GF-2026-000123.pdf",
    );
    expect(response.headers.get("x-correlation-id")).toBe("mt-249-pdf");
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe(
      "%PDF-persisted",
    );
    expect(generatePreliminaryReportPdf).toHaveBeenCalledWith(report);
  });

  it("uses the stable assessment-not-found code when no saved report exists", async () => {
    vi.stubEnv("NODE_ENV", "development");
    getSavedPreliminaryReportById.mockResolvedValue(null);

    const response = await GET(
      new Request(
        `http://127.0.0.1:3000/api/internal/assessments/${ASSESSMENT_ID}/report`,
      ),
      { params: Promise.resolve({ id: ASSESSMENT_ID }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ASSESSMENT_NOT_FOUND" },
    });
  });

  it("uses the stable report-generation code for renderer failures", async () => {
    vi.stubEnv("NODE_ENV", "development");
    getSavedPreliminaryReportById.mockResolvedValue(report);
    generatePreliminaryReportPdf.mockRejectedValue(
      new Error("REPORT_RENDERER_TIMEOUT"),
    );

    const response = await GET(
      new Request(
        `http://127.0.0.1:3000/api/internal/assessments/${ASSESSMENT_ID}/report`,
      ),
      { params: Promise.resolve({ id: ASSESSMENT_ID }) },
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "REPORT_GENERATION_FAILED" },
    });
  });
});
