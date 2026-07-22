import { describe, expect, it, vi } from "vitest";
import { createDataAccessGateway } from "../fixtures/normalized-data-access";
import { buildSessionAssessment } from "@/modules/assessment/build-session-assessment";
import { runDataAccessSpike } from "@/modules/data-access-spike/run-data-access-spike";
import { generateSessionReportPdf } from "@/modules/reporting/report-renderer";
import { parseSessionReportRequest } from "@/modules/reporting/report-request";
import {
  createSessionReportTokenService,
  issueSessionReportToken,
} from "@/modules/reporting/report-token";
import {
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
    mapImageDataUrl:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGL5//8/AAAA//+rxzhLAAAABklEQVQDAAYOAwJctCtXAAAAAElFTkSuQmCC",
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

  it("prints only report-allowed evidence with its attribution", async () => {
    const request = await reportRequest();

    const html = renderSessionReportHtml(request);

    expect(html).toContain("NZ Building Outlines");
    expect(html).toContain("NZ Addresses");
    expect(html).toContain("Land Information New Zealand (LINZ), CC BY 4.0");
    expect(html).toContain("Creative Commons Attribution 4.0 International");
    expect(html).not.toContain("Auckland Council");
    expect(html).not.toContain("Watercare Services Limited");
  });

  it("renders the six feasibility categories on the constraints page", async () => {
    const request = await reportRequest();

    const html = renderSessionReportHtml(request);

    expect(html.match(/class="category-row"/g)).toHaveLength(6);
    expect(html).toContain("available space");
    expect(html).toContain("construction access");
  });

  it("rejects missing and non-PNG map captures", async () => {
    const request = await reportRequest();
    const reportToken = issueSessionReportToken(request.assessment);
    expect(() =>
      parseSessionReportRequest({
        reportToken,
        mapImageDataUrl: "https://example.test/map.png",
      }),
    ).toThrow("INVALID_MAP_IMAGE");
    expect(() =>
      parseSessionReportRequest({ mapImageDataUrl: request.mapImageDataUrl }),
    ).toThrow("INVALID_REPORT");
  });

  it("rejects a map capture that is not valid PNG bytes", async () => {
    const request = await reportRequest();
    const reportToken = issueSessionReportToken(request.assessment);

    expect(() =>
      parseSessionReportRequest({
        reportToken,
        mapImageDataUrl:
          "data:image/png;base64,x\" onerror=\"fetch('http://127.0.0.1:1/security-probe')",
      }),
    ).toThrow("INVALID_MAP_IMAGE");
  });

  it("rejects a PNG whose declared dimensions exceed the renderer bound", async () => {
    const request = await reportRequest();
    const reportToken = issueSessionReportToken(request.assessment);
    const png = Buffer.from(
      request.mapImageDataUrl.slice("data:image/png;base64,".length),
      "base64",
    );
    png.writeUInt32BE(10_000, 16);

    expect(() =>
      parseSessionReportRequest({
        reportToken,
        mapImageDataUrl: `data:image/png;base64,${png.toString("base64")}`,
      }),
    ).toThrow("INVALID_MAP_IMAGE");
  });

  it("rejects a truncated PNG header without complete image chunks", async () => {
    const request = await reportRequest();
    const reportToken = issueSessionReportToken(request.assessment);
    const truncated = Buffer.alloc(24);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(truncated);
    truncated.writeUInt32BE(13, 8);
    truncated.write("IHDR", 12, "ascii");
    truncated.writeUInt32BE(1, 16);
    truncated.writeUInt32BE(1, 20);

    expect(() =>
      parseSessionReportRequest({
        reportToken,
        mapImageDataUrl: `data:image/png;base64,${truncated.toString("base64")}`,
      }),
    ).toThrow("INVALID_MAP_IMAGE");
  });

  it("rejects client-submitted assessment facts even with a server-issued token", async () => {
    const request = await reportRequest();
    const reportToken = issueSessionReportToken(request.assessment);

    expect(() =>
      parseSessionReportRequest({
        reportToken,
        mapImageDataUrl: request.mapImageDataUrl,
        assessment: {
          ...request.assessment,
          property: {
            ...request.assessment.property,
            address: "Forged address",
          },
        },
      }),
    ).toThrow("INVALID_REPORT");
  });

  it("verifies a signed report snapshot without shared retained state", async () => {
    const request = await reportRequest();
    const signingKey = "test-only-report-signing-key-with-32-bytes";
    const issuer = createSessionReportTokenService(signingKey, () => 1_000);
    const verifier = createSessionReportTokenService(signingKey, () => 2_000);
    const reportToken = issuer.issue(request.assessment);

    const assessment = verifier.verify(reportToken);

    expect(assessment.property.address).toBe(
      "42A Bahari Drive, Ranui, Auckland",
    );
  });

  it("rejects an oversized trusted assessment before issuing a report token", async () => {
    const request = await reportRequest();
    request.assessment.limitations.push("x".repeat(50_000));

    expect(() => issueSessionReportToken(request.assessment)).toThrow(
      "INVALID_REPORT",
    );
  });

  it("rejects malformed trusted report fields before issuing a token", async () => {
    const request = await reportRequest();
    request.assessment.property.generatedAt = "not-an-iso-date";

    expect(() => issueSessionReportToken(request.assessment)).toThrow(
      "INVALID_REPORT",
    );
  });

  it("uses the injected renderer seam and returns its PDF bytes", async () => {
    const request = await reportRequest();
    const render = vi.fn().mockResolvedValue(Buffer.from("%PDF-test"));

    const pdf = await generateSessionReportPdf(request, { render });

    expect(pdf.toString()).toBe("%PDF-test");
    expect(render).toHaveBeenCalledWith(
      expect.stringContaining("Page 3 of 3"),
      expect.any(AbortSignal),
    );
  });

  it("rejects a second report while the renderer is busy", async () => {
    const request = await reportRequest();
    let finishFirst!: (pdf: Buffer) => void;
    const firstPdf = new Promise<Buffer>((resolve) => {
      finishFirst = resolve;
    });
    const render = vi
      .fn()
      .mockImplementationOnce(() => firstPdf)
      .mockResolvedValueOnce(Buffer.from("%PDF-unbounded-second"));

    const first = generateSessionReportPdf(request, { render });
    await expect(generateSessionReportPdf(request, { render })).rejects.toThrow(
      "REPORT_RENDERER_BUSY",
    );
    finishFirst(Buffer.from("%PDF-first"));
    await first;
  });

  it("aborts a report that exceeds the renderer deadline", async () => {
    vi.useFakeTimers();
    try {
      const request = await reportRequest();
      const render = vi.fn((_html: string, signal?: AbortSignal) => {
        if (!signal) return Promise.reject(new Error("MISSING_ABORT_SIGNAL"));
        return new Promise<Buffer>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new Error("ABORTED")), {
            once: true,
          });
        });
      });

      const pdf = generateSessionReportPdf(request, { render });
      const timedOut = expect(pdf).rejects.toThrow("REPORT_RENDERER_TIMEOUT");
      await vi.advanceTimersByTimeAsync(15_000);

      await timedOut;
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns the timeout deadline even when a renderer ignores abort", async () => {
    vi.useFakeTimers();
    try {
      const request = await reportRequest();
      let finishRender!: (value: Buffer) => void;
      const render = vi.fn(
        () =>
          new Promise<Buffer>((resolve) => {
            finishRender = resolve;
          }),
      );
      const outcome = generateSessionReportPdf(request, { render }).then(
        () => "resolved",
        (error: unknown) =>
          error instanceof Error ? error.message : "unknown-error",
      );

      await vi.advanceTimersByTimeAsync(15_000);

      expect(
        await Promise.race([outcome, Promise.resolve("still-pending")]),
      ).toBe("REPORT_RENDERER_TIMEOUT");
      finishRender(Buffer.from("%PDF-late"));
      await Promise.resolve();
    } finally {
      vi.useRealTimers();
    }
  });
});
