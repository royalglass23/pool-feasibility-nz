import { describe, expect, it, vi } from "vitest";
import { createDataAccessGateway } from "../fixtures/normalized-data-access";
import { buildSessionAssessment } from "@/modules/assessment/build-session-assessment";
import { runDataAccessSpike } from "@/modules/data-access-spike/run-data-access-spike";
import {
  generateSessionReportPdf,
  parseSessionReportRequest,
  renderSessionReportHtml,
  sessionReportFilename,
} from "@/modules/reporting/session-report";

async function reportRequest() {
  const result = await runDataAccessSpike({
    requestedAddress: "42A Bahari Drive, Ranui, Auckland",
    gateway: createDataAccessGateway(),
    now: () => new Date("2026-07-20T01:02:03.000Z"),
  });
  return {
    assessment: buildSessionAssessment(result),
    mapImageDataUrl: "data:image/png;base64,iVBORw0KGgo=",
  };
}

describe("session PDF report", () => {
  it("renders exactly three A4 report pages from bounded session data", async () => {
    const request = await reportRequest();
    const html = renderSessionReportHtml(request);

    expect(html.match(/<section class="page">/g)).toHaveLength(3);
    expect(html).toContain("Page 1 of 3");
    expect(html).toContain("Page 2 of 3");
    expect(html).toContain("Page 3 of 3");
    expect(html).toContain("Executive summary");
    expect(html).toContain("Property constraints");
    expect(html).toContain("Risks and actions");
    expect(html).toContain(request.mapImageDataUrl);
    expect(sessionReportFilename(request.assessment)).toBe(
      "pool-feasibility-2359811.pdf",
    );
  });

  it("escapes report data before placing it in HTML", async () => {
    const request = await reportRequest();
    request.assessment.property.address = '<img src=x onerror="alert(1)">';

    const html = renderSessionReportHtml(request);

    expect(html).not.toContain('<img src=x onerror="alert(1)">');
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("rejects missing and non-PNG map captures", async () => {
    const request = await reportRequest();
    expect(() =>
      parseSessionReportRequest({
        ...request,
        mapImageDataUrl: "https://example.test/map.png",
      }),
    ).toThrow("INVALID_MAP_IMAGE");
    expect(() =>
      parseSessionReportRequest({ mapImageDataUrl: request.mapImageDataUrl }),
    ).toThrow("INVALID_REPORT");
  });

  it("uses the injected renderer seam and returns its PDF bytes", async () => {
    const request = await reportRequest();
    const render = vi.fn().mockResolvedValue(Buffer.from("%PDF-test"));

    const pdf = await generateSessionReportPdf(request, { render });

    expect(pdf.toString()).toBe("%PDF-test");
    expect(render).toHaveBeenCalledWith(expect.stringContaining("Page 3 of 3"));
  });
});
