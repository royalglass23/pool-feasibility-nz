import { afterEach, describe, expect, it, vi } from "vitest";

const handlers = vi.hoisted(() => ({
  addressSuggestions: vi.fn(async () => new Response(null, { status: 204 })),
  aerialConflicts: vi.fn(async () => new Response(null, { status: 204 })),
  aerialTile: vi.fn(async () => new Response(null, { status: 204 })),
  assessmentGet: vi.fn(async () => new Response(null, { status: 204 })),
  assessmentPost: vi.fn(async () => new Response(null, { status: 204 })),
  propertyCheck: vi.fn(async () => new Response(null, { status: 204 })),
  propertyStages: vi.fn(async () => new Response(null, { status: 204 })),
  reportPdf: vi.fn(async () => new Response(null, { status: 204 })),
}));

vi.mock("server-only", () => ({}));
vi.mock(
  "@/modules/data-access-spike/handle-address-suggestions-request",
  () => ({ handleAddressSuggestionsRequest: handlers.addressSuggestions }),
);
vi.mock("@/modules/spatial/handle-aerial-conflicts-request", () => ({
  POST: handlers.aerialConflicts,
}));
vi.mock("@/modules/providers/linz/handle-aerial-tile-request", () => ({
  GET: handlers.aerialTile,
}));
vi.mock("@/modules/assessment/handle-assessment-requests", () => ({
  GET: handlers.assessmentGet,
  POST: handlers.assessmentPost,
}));
vi.mock(
  "@/modules/data-access-spike/handle-fast-property-view-request",
  () => ({ POST: handlers.propertyCheck }),
);
vi.mock(
  "@/modules/data-access-spike/handle-fast-property-stages-request",
  () => ({ POST: handlers.propertyStages }),
);
vi.mock("@/modules/reporting/handle-report-pdf-request", () => ({
  handleReportPdfRequest: handlers.reportPdf,
}));

import { POST as publicAddress } from "@/app/api/public/address-suggestions/route";
import { POST as publicAerialConflicts } from "@/app/api/public/aerial-conflicts/route";
import { GET as publicAerialTile } from "@/app/api/public/aerial/tiles/[z]/[x]/[y]/route";
import { POST as publicAssessment } from "@/app/api/public/assessments/route";
import { POST as publicPropertyCheck } from "@/app/api/public/property-check/route";
import { POST as publicPropertyStages } from "@/app/api/public/property-check/stages/route";
import { POST as publicReport } from "@/app/api/public/report/pdf/route";
import { POST as internalAddress } from "@/app/api/internal/address-suggestions/route";
import { POST as internalAerialConflicts } from "@/app/api/internal/aerial-conflicts/route";
import { GET as internalAerialTile } from "@/app/api/internal/aerial/tiles/[z]/[x]/[y]/route";
import { POST as internalAssessment } from "@/app/api/internal/assessments/route";
import { POST as internalPropertyCheck } from "@/app/api/internal/fast-property-view/route";
import { POST as internalPropertyStages } from "@/app/api/internal/fast-property-view/stages/route";
import { POST as internalReport } from "@/app/api/internal/report/pdf/route";

const tileContext = {
  params: Promise.resolve({ z: "18", x: "258210", y: "160518" }),
};

const publicRoutes = [
  ["address suggestions", publicAddress, "/api/public/address-suggestions"],
  ["aerial conflicts", publicAerialConflicts, "/api/public/aerial-conflicts"],
  ["assessment submission", publicAssessment, "/api/public/assessments"],
  ["property check", publicPropertyCheck, "/api/public/property-check"],
  ["property stages", publicPropertyStages, "/api/public/property-check/stages"],
  ["PDF report", publicReport, "/api/public/report/pdf"],
] as const;

const internalRoutes = [
  ["address suggestions", internalAddress, "/api/internal/address-suggestions"],
  ["aerial conflicts", internalAerialConflicts, "/api/internal/aerial-conflicts"],
  ["assessment submission", internalAssessment, "/api/internal/assessments"],
  ["property check", internalPropertyCheck, "/api/internal/fast-property-view"],
  ["property stages", internalPropertyStages, "/api/internal/fast-property-view/stages"],
  ["PDF report", internalReport, "/api/internal/report/pdf"],
] as const;

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("explicit public and legacy-internal route adapters", () => {
  it.each(publicRoutes)(
    "allows anonymous access to public %s",
    async (_name, route, path) => {
      vi.stubEnv("NODE_ENV", "production");
      const response = await route(
        new Request(`https://pool.example${path}`, { method: "POST" }),
      );
      expect(response.status).toBe(204);
    },
  );

  it("allows anonymous access to the public aerial tile adapter", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await publicAerialTile(
      new Request(
        "https://pool.example/api/public/aerial/tiles/18/258210/160518",
      ),
      tileContext,
    );
    expect(response.status).toBe(204);
  });

  it.each(internalRoutes)(
    "denies unauthenticated access to internal %s before application work",
    async (_name, route, path) => {
      vi.stubEnv("NODE_ENV", "production");
      const response = await route(
        new Request(`https://pool.example${path}`, { method: "POST" }),
      );
      expect(response.status).toBe(503);
    },
  );

  it("denies the unauthenticated internal aerial tile adapter", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await internalAerialTile(
      new Request(
        "https://pool.example/api/internal/aerial/tiles/18/258210/160518",
      ),
      tileContext,
    );
    expect(response.status).toBe(503);
    expect(handlers.aerialTile).not.toHaveBeenCalled();
  });
});
