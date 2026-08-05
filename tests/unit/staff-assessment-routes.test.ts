import { afterEach, describe, expect, it, vi } from "vitest";
import {
  savedPreliminaryReport,
  staffAssessmentDetail,
  staffAssessmentSummaries,
} from "../fixtures/staff-assessment";

const getDb = vi.hoisted(() => vi.fn(() => ({}) as never));
const staffSessionDeniedResponse = vi.hoisted(() => vi.fn());
const listHomeownerAssessments = vi.hoisted(() => vi.fn());
const getHomeownerAssessmentById = vi.hoisted(() => vi.fn());
const getSavedPreliminaryReportById = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () => ({ getDb }));
vi.mock("@/modules/staff/staff-session", () => ({
  staffSessionDeniedResponse,
}));
vi.mock("@/db/repositories/homeowner-assessment-repository", () => ({
  listHomeownerAssessments,
  getHomeownerAssessmentById,
  getSavedPreliminaryReportById,
}));

import { GET as GET_LIST } from "@/app/api/internal/assessments/route";
import { GET as GET_DETAIL } from "@/app/api/internal/assessments/[id]/route";

afterEach(() => {
  getDb.mockClear();
  staffSessionDeniedResponse.mockReset();
  listHomeownerAssessments.mockReset();
  getHomeownerAssessmentById.mockReset();
  getSavedPreliminaryReportById.mockReset();
  vi.unstubAllEnvs();
});

describe("staff assessment reads", () => {
  it("rejects an unauthenticated list request before reading saved assessments", async () => {
    staffSessionDeniedResponse.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "STAFF_AUTH_REQUIRED" } }), {
        status: 401,
      }),
    );

    const response = await GET_LIST(
      new Request("https://pool.example/api/internal/assessments"),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "STAFF_AUTH_REQUIRED" },
    });
    expect(getDb).not.toHaveBeenCalled();
    expect(listHomeownerAssessments).not.toHaveBeenCalled();
  });

  it("returns the saved assessment list to an authenticated Admin", async () => {
    staffSessionDeniedResponse.mockResolvedValue(null);
    listHomeownerAssessments.mockResolvedValue(staffAssessmentSummaries);

    const response = await GET_LIST(
      new Request("https://pool.example/api/internal/assessments"),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.assessments[0]).toMatchObject({ id: "assessment-new" });
  });

  it("returns the staff record with the persisted shared homeowner report to an authenticated Admin", async () => {
    staffSessionDeniedResponse.mockResolvedValue(null);
    getHomeownerAssessmentById.mockResolvedValue(staffAssessmentDetail);
    getSavedPreliminaryReportById.mockResolvedValue(savedPreliminaryReport);

    const response = await GET_DETAIL(
      new Request(
        "https://pool.example/api/internal/assessments/assessment-new",
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
