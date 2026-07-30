import { describe, expect, it } from "vitest";
import { generatePreliminaryReportPdf } from "@/modules/reporting/report-renderer";
import { buildTestPreliminaryReport } from "../fixtures/preliminary-report";

const report = buildTestPreliminaryReport({
  summary: "The selected pool needs checking.",
  recommendations: [
    {
      phase: "before_concept_design",
      priority: 1,
      title: "Confirm the mapped evidence",
      reason: "Ask Royal Glass to review the detailed official checks.",
    },
  ],
  sources: [
    {
      provider: "Land Information New Zealand",
      dataset: "NZ Parcels",
      status: "available",
      evidenceUse: "report_allowed",
      licence: "Creative Commons Attribution 4.0 International",
      attribution: "Land Information New Zealand (LINZ), CC BY 4.0",
      sourceUrl: "https://data.linz.govt.nz/",
    },
  ],
});

describe("persisted preliminary report renderer", () => {
  it("renders the shared saved report through the real local Chromium boundary", async () => {
    const pdf = await generatePreliminaryReportPdf(report);
    const source = pdf.toString("latin1");

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(10_000);
    expect(source.match(/\/Type\s*\/Page\b/g)).toHaveLength(3);
  }, 30_000);

  it("returns byte-identical PDFs for retries of the same saved report", async () => {
    const first = await generatePreliminaryReportPdf(report);
    const second = await generatePreliminaryReportPdf(report);

    expect(second.equals(first)).toBe(true);
  }, 60_000);
});
