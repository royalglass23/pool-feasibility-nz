import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeownerFeasibilityReportView } from "@/components/homeowner-feasibility-report-view";
import {
  deliverAssessmentReport,
  type AssessmentDeliveryStore,
} from "@/modules/reporting/assessment-report-delivery";
import { renderCanonicalPreliminaryReportHtml } from "@/modules/reporting/preliminary-report-html";
import { assessmentStatusLabel } from "@/modules/reporting/pool-feasibility-report";
import { buildTestPreliminaryReport } from "../fixtures/preliminary-report";

afterEach(cleanup);

describe("web, PDF and email report consistency", () => {
  it("uses a colour-coded description without naming the colour", () => {
    expect(assessmentStatusLabel("red")).toBe("Potential Constraint");
    expect(assessmentStatusLabel("amber")).toBe(
      "Further investigation required",
    );
    expect(assessmentStatusLabel("green")).toBe("Appears suitable");
  });

  it("presents the same saved result without recalculating the assessment", async () => {
    const report = buildTestPreliminaryReport({
      reference: "GF-2026-000019",
      property: { address: "42A Bahari Drive, Rānui, Auckland" },
      pool: { lengthMetres: 6.5, widthMetres: 3 },
      overall: {
        status: "amber",
        headline: "Further investigation required",
        summary:
          "The proposed pool appears feasible, but mapped wastewater infrastructure should be checked before the position is finalised.",
        recommendedStage: "Site verification",
      },
      keyFindings: [
        {
          id: "wastewater-nearby",
          category: "wastewater",
          severity: "red",
          title: "Wastewater infrastructure near the proposed pool",
          clientSummary:
            "Mapped wastewater infrastructure is located close to the proposed pool area.",
        },
      ],
      sources: [
        {
          provider: "Auckland Council",
          dataset: "Stormwater",
          status: "unavailable",
          queryStatus: "unavailable",
          evidenceUse: "unavailable",
          licence: "Not available for this check.",
          attribution: null,
          sourceUrl: null,
          retrievedAt: null,
        },
        {
          provider: "Watercare",
          dataset: "Wastewater",
          status: "error",
          queryStatus: "error",
          evidenceUse: "unavailable",
          licence: "Not available for this check.",
          attribution: null,
          sourceUrl: null,
          retrievedAt: null,
        },
        {
          provider: "Vector",
          dataset: "Electricity",
          status: "empty",
          queryStatus: "empty",
          evidenceUse: "report_allowed",
          licence: "Fixture licence.",
          attribution: null,
          sourceUrl: null,
          retrievedAt: null,
        },
      ],
    });

    render(
      <HomeownerFeasibilityReportView
        report={report}
        delivery={{ homeowner: "sent", internal_test_report: "sent" }}
        onBack={() => undefined}
      />,
    );
    const pdfHtml = renderCanonicalPreliminaryReportHtml(report);

    const send = vi.fn().mockResolvedValue({ id: "email-1" });
    const store: AssessmentDeliveryStore = {
      claim: vi.fn(async (_reference, channel) =>
        channel === "homeowner"
          ? {
              channel,
              claimToken: "homeowner-claim",
              homeownerName: "Jane Homeowner",
              homeownerEmail: "jane@example.com",
              report,
            }
          : null,
      ),
      markSent: vi.fn(async () => undefined),
      markFailed: vi.fn(async () => undefined),
    };
    await deliverAssessmentReport(report.reference, {
      store,
      renderPdf: vi.fn().mockResolvedValue(Buffer.from("%PDF-same-snapshot")),
      send,
      from: "Royal Glass <reports@example.com>",
      deliveryEnvironment: {
        mode: "synthetic_test",
        vercelEnvironment: "preview",
        nodeEnvironment: "production",
      },
    });
    const email = send.mock.calls[0]?.[0] as {
      subject: string;
      html: string;
      text: string;
      attachment?: Buffer;
    };

    for (const value of [
      report.reference,
      report.property.address,
      report.overall.summary,
      report.keyFindings[0]!.title,
      report.overall.recommendedStage,
    ]) {
      expect(pdfHtml).toContain(value);
      expect(`${email.html}\n${email.text}`).toContain(value);
    }
    expect(
      screen.getByRole("heading", {
        name: "Preliminary Pool Feasibility Report",
      }),
    ).toBeVisible();
    expect(screen.getByText(report.property.address)).toBeVisible();
    expect(screen.getByText(report.overall.summary)).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "How this assessment works" }),
    ).toBeVisible();
    expect(screen.getByText("Check the mapped evidence")).toBeInTheDocument();
    expect(screen.getByText("Open guide")).toBeVisible();
    expect(
      screen.getByText(/This is not automatically a no\./i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /This is an indicative desktop screen based on mapped information/i,
      ),
    ).toBeVisible();
    expect(screen.queryByText("Evidence to confirm")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Does this property appear worth progressing?"),
    ).not.toBeInTheDocument();
    expect(screen.getByText(report.keyFindings[0]!.title)).toBeVisible();
    expect(
      screen.getByRole("region", {
        name: "Overall assessment",
      }),
    ).toHaveTextContent(report.overall.recommendedStage);
    expect(pdfHtml).toContain(assessmentStatusLabel(report.overall.status));
    expect(pdfHtml).toContain(
      "This preliminary feasibility report is an indicative desktop screen based on available mapped information.",
    );
    expect(pdfHtml).not.toContain("Evidence to confirm");
    expect(`${email.html}\n${email.text}`).toContain(
      assessmentStatusLabel(report.overall.status),
    );
    expect(email.subject).toBe(
      "Your Preliminary Pool Feasibility Report - 42A Bahari Drive",
    );
    expect(email.attachment).toEqual(Buffer.from("%PDF-same-snapshot"));
  });
});
