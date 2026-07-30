import { afterEach, describe, expect, it, vi } from "vitest";
import {
  savedPreliminaryReport,
  staffAssessmentDetail,
  staffAssessmentSummaries,
} from "../fixtures/staff-assessment";

const getDb = vi.hoisted(() => vi.fn(() => ({}) as never));
const listHomeownerAssessments = vi.hoisted(() => vi.fn());
const getHomeownerAssessmentById = vi.hoisted(() => vi.fn());
const getSavedPreliminaryReportById = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () => ({ getDb }));
vi.mock("@/db/repositories/homeowner-assessment-repository", () => ({
  listHomeownerAssessments,
  getHomeownerAssessmentById,
  getSavedPreliminaryReportById,
}));

import { GET as GET_LIST } from "@/app/api/internal/assessments/route";
import { GET as GET_DETAIL } from "@/app/api/internal/assessments/[id]/route";

afterEach(() => {
  getDb.mockClear();
  listHomeownerAssessments.mockReset();
  getHomeownerAssessmentById.mockReset();
  getSavedPreliminaryReportById.mockReset();
  vi.unstubAllEnvs();
});

describe("development-only staff assessment reads", () => {
  it("allows no-auth reads from a non-loopback development host", async () => {
    vi.stubEnv("NODE_ENV", "development");
    listHomeownerAssessments.mockResolvedValue(staffAssessmentSummaries);

    const response = await GET_LIST(
      new Request("http://192.168.1.20:3000/api/internal/assessments"),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.assessments[0]).toMatchObject({ id: "assessment-new" });
  });

  it("fails closed in production even when generic internal credentials exist", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INTERNAL_ACCESS_USERNAME", "staff");
    vi.stubEnv("INTERNAL_ACCESS_PASSWORD", "secret");
    const authorization = `Basic ${Buffer.from("staff:secret").toString("base64")}`;

    const response = await GET_LIST(
      new Request("https://pool.example/api/internal/assessments", {
        headers: { authorization },
      }),
    );

    expect(response.status).toBe(503);
    expect(getDb).not.toHaveBeenCalled();
    expect(listHomeownerAssessments).not.toHaveBeenCalled();
  });

  it("returns the staff record with the persisted shared homeowner report", async () => {
    vi.stubEnv("NODE_ENV", "development");
    getHomeownerAssessmentById.mockResolvedValue(staffAssessmentDetail);
    getSavedPreliminaryReportById.mockResolvedValue(savedPreliminaryReport);

    const response = await GET_DETAIL(
      new Request(
        "http://192.168.1.20:3000/api/internal/assessments/assessment-new",
      ),
      { params: Promise.resolve({ id: "assessment-new" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        assessment: {
          id: "assessment-new",
          report: {
            reference: "GF-2026-000042",
            mapImageDataUrl: savedPreliminaryReport.mapImageDataUrl,
          },
        },
      },
    });
  });
});
