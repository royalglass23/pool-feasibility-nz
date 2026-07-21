import { describe, expect, it } from "vitest";
import { createDataAccessGateway } from "../fixtures/normalized-data-access";
import { buildSessionAssessment } from "@/modules/assessment/build-session-assessment";
import { runDataAccessSpike } from "@/modules/data-access-spike/run-data-access-spike";
import { generateSessionReportPdf } from "@/modules/reporting/session-report";

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
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=",
    });
    const source = pdf.toString("latin1");

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(source.match(/\/Type\s*\/Page\b/g)).toHaveLength(3);
  });
});
