import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { createDataAccessGateway } from "../fixtures/normalized-data-access";
import { buildSessionAssessment } from "@/modules/assessment/build-session-assessment";
import { runDataAccessSpike } from "@/modules/data-access-spike/run-data-access-spike";
import { generateSessionReportPdf } from "@/modules/reporting/report-renderer";

describe("Playwright session report renderer", { timeout: 30_000 }, () => {
  it("produces a real three-page PDF", async () => {
    const result = await runDataAccessSpike({
      requestedAddress: "42A Bahari Drive, Ranui, Auckland",
      gateway: createDataAccessGateway(),
      now: () => new Date("2026-07-20T01:02:03.000Z"),
    });

    const pdf = await generateSessionReportPdf({
      assessment: buildSessionAssessment(result),
      mapImageDataUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGL5//8/AAAA//+rxzhLAAAABklEQVQDAAYOAwJctCtXAAAAAElFTkSuQmCC",
    });
    const source = pdf.toString("latin1");

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(source.match(/\/Type\s*\/Page\b/g)).toHaveLength(3);
  });

  it("blocks outbound requests from report HTML", async () => {
    let requestCount = 0;
    const probe = createServer((_request, response) => {
      requestCount += 1;
      response.end("probe");
    });
    await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));

    try {
      const result = await runDataAccessSpike({
        requestedAddress: "42A Bahari Drive, Ranui, Auckland",
        gateway: createDataAccessGateway(),
        now: () => new Date("2026-07-20T01:02:03.000Z"),
      });
      const { port } = probe.address() as AddressInfo;

      await generateSessionReportPdf({
        assessment: buildSessionAssessment(result),
        mapImageDataUrl: `http://127.0.0.1:${port}/security-probe`,
      });

      expect(requestCount).toBe(0);
    } finally {
      await new Promise<void>((resolve, reject) =>
        probe.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
