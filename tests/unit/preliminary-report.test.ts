import { describe, expect, it } from "vitest";
import { renderPreliminaryReportHtml } from "@/modules/reporting/preliminary-report";
import { renderCanonicalPreliminaryReportHtml } from "@/modules/reporting/preliminary-report-html";
import { buildTestPreliminaryReport } from "../fixtures/preliminary-report";

describe("preliminary report compatibility entry point", () => {
  it("delegates to the canonical three-page presentation", () => {
    const report = buildTestPreliminaryReport();

    expect(renderPreliminaryReportHtml(report)).toBe(
      renderCanonicalPreliminaryReportHtml(report),
    );
  });
});
