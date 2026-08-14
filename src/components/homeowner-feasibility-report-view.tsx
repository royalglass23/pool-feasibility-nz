"use client";

import { useState } from "react";
import { SavedReportInteractiveMap } from "@/components/saved-report-interactive-map";
import type { ReportDeliveryState } from "@/components/saved-preliminary-report-view";
import { type SavedPreliminaryReport } from "@/modules/reporting/preliminary-report";
import {
  assessmentStatusLabel,
  formatReportNumber,
  REPORT_ASSESSMENT_ORDER,
  reportShortStatus,
  type AssessmentStatus,
  type ReportAssessment,
} from "@/modules/reporting/pool-feasibility-report";
import { formatReportGeneratedAt } from "@/modules/reporting/preliminary-report-presentation";

export function HomeownerFeasibilityReportView({
  report,
  delivery,
  onBack,
  showBackAction = true,
  downloadAccessToken,
  onStartAgain,
}: {
  report: SavedPreliminaryReport;
  delivery: {
    homeowner: ReportDeliveryState;
    internal_test_report: ReportDeliveryState;
  };
  onBack: () => void;
  showBackAction?: boolean;
  downloadAccessToken?: string;
  onStartAgain?: () => void;
}) {
  void delivery;
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function downloadPdf() {
    if (!downloadAccessToken || isDownloading) return;

    setIsDownloading(true);
    setDownloadError(null);
    try {
      const response = await fetch("/api/public/assessments/report/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: downloadAccessToken }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(
          body?.error?.message ?? "The PDF could not be generated.",
        );
      }

      const objectUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `${report.reference}-preliminary-pool-feasibility-report.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setDownloadError(
        error instanceof Error
          ? error.message
          : "The PDF could not be generated. Your saved report remains available.",
      );
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <article
      aria-labelledby="saved-report-heading"
      className="border-pool-200 text-pool-900 mx-auto w-full max-w-6xl overflow-hidden rounded-2xl border bg-white shadow-sm"
    >
      <header className="border-pool-200 border-b px-5 py-5 sm:px-8 lg:px-10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-pool-500 font-mono text-xs font-semibold">
              {report.reference}
            </p>
            <h2
              id="saved-report-heading"
              className="text-pool-950 mt-2 text-2xl font-semibold tracking-[-0.025em] sm:text-3xl"
            >
              Preliminary Pool Feasibility Report
            </h2>
            <p className="text-pool-800 mt-2 text-base font-medium">
              {report.property.address}
            </p>
            <p className="text-pool-600 mt-1 text-sm">
              Proposed pool: {formatReportNumber(report.pool.lengthMetres)} x{" "}
              {formatReportNumber(report.pool.widthMetres)} m · Generated{" "}
              {formatReportGeneratedAt(report.generatedAt)}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row lg:justify-end">
            {downloadAccessToken && (
              <button
                type="button"
                onClick={() => void downloadPdf()}
                disabled={isDownloading}
                className="border-pool-300 text-pool-800 hover:bg-pool-50 focus-visible:outline-pool-blue-700 min-h-11 rounded-xl border bg-white px-4 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:text-pool-400"
              >
                {isDownloading ? "Downloading report…" : "Download PDF"}
              </button>
            )}
            {showBackAction && (
              <button
                type="button"
                onClick={onBack}
                className="border-pool-300 text-pool-800 hover:bg-pool-50 focus-visible:outline-pool-blue-700 min-h-11 rounded-xl border bg-white px-4 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Back to assessment
              </button>
            )}
          </div>
        </div>

        <p className="text-pool-blue-800 mt-4 text-sm font-semibold">
          We will email a summary of this preliminary report shortly. Check Spam
          or Promotions if it is not in your inbox.
        </p>
        {downloadError && (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950"
          >
            {downloadError}
          </p>
        )}
      </header>

      <div className="space-y-10 px-5 py-7 sm:px-8 lg:px-10 lg:py-10">
        <section
          aria-labelledby="overall-result-heading"
          className={`rounded-2xl border p-5 sm:p-6 ${statusPanelClasses(report.overall.status)}`}
        >
          <p className="text-sm font-bold">
            {assessmentStatusLabel(report.overall.status)}
          </p>
          <h3
            id="overall-result-heading"
            className="mt-3 text-xl font-semibold tracking-[-0.02em] sm:text-2xl"
          >
            Does this property appear worth progressing?
          </h3>
          <p className="mt-3 max-w-3xl text-base leading-7">
            {report.overall.summary}
          </p>
          <p className="mt-4 text-sm font-semibold">
            Recommended next stage: {report.overall.recommendedStage}
          </p>
        </section>

        <section aria-labelledby="at-a-glance-heading">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <h3
              id="at-a-glance-heading"
              className="text-pool-950 text-xl font-semibold tracking-[-0.02em]"
            >
              At a glance
            </h3>
            <p className="text-pool-600 text-sm">
              Status is always shown in words as well as colour.
            </p>
          </div>
          <dl className="border-pool-200 mt-4 overflow-hidden rounded-xl border sm:grid sm:grid-cols-2">
            {REPORT_ASSESSMENT_ORDER.map((id) => {
              const item = report.assessments[id];
              return (
                <div
                  key={id}
                  className="border-pool-200 flex min-h-14 items-center justify-between gap-4 border-b px-4 py-3 last:border-b-0 sm:[&:nth-child(odd)]:border-r sm:[&:nth-last-child(-n+2)]:border-b-0"
                >
                  <dt className="text-pool-900 font-semibold">{item.title}</dt>
                  <dd
                    className={`text-right text-sm font-bold ${statusTextClasses(item.status)}`}
                  >
                    {reportShortStatus(item.status)}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>

        <section aria-labelledby="report-map-heading">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h3
                id="report-map-heading"
                className="text-pool-950 text-xl font-semibold tracking-[-0.02em]"
              >
                Assessment map
              </h3>
              <p className="text-pool-600 mt-1 text-sm">
                The saved map reflects the layers visible when this report was
                generated.
              </p>
            </div>
          </div>
          <SavedReportInteractiveMap
            report={report}
            attribution={compactAttribution(report)}
          />
        </section>

        <section aria-labelledby="key-findings-heading">
          <h3
            id="key-findings-heading"
            className="text-pool-950 text-xl font-semibold tracking-[-0.02em]"
          >
            Key findings
          </h3>
          <div className="divide-pool-200 border-pool-200 mt-4 divide-y border-y">
            {report.keyFindings.map((finding) => (
              <article
                key={finding.id}
                className="grid gap-2 py-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-5"
              >
                <p
                  className={`text-sm font-bold ${statusTextClasses(finding.severity)}`}
                >
                  {reportShortStatus(finding.severity)}
                </p>
                <div>
                  <h4 className="text-pool-950 font-semibold">
                    {finding.title}
                  </h4>
                  <p className="text-pool-700 mt-1 max-w-3xl text-sm leading-6">
                    {finding.clientSummary}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="site-assessment-heading">
          <h3
            id="site-assessment-heading"
            className="text-pool-950 text-xl font-semibold tracking-[-0.02em]"
          >
            Site assessment
          </h3>
          <p className="text-pool-600 mt-2 max-w-3xl text-sm leading-6">
            Approximate mapped information supports early planning only. Open
            technical details only when you need the saved source context.
          </p>
          <div className="divide-pool-200 border-pool-200 mt-5 divide-y border-y">
            {REPORT_ASSESSMENT_ORDER.map((id) => (
              <AssessmentSection key={id} assessment={report.assessments[id]} />
            ))}
          </div>
        </section>

        <section
          aria-labelledby="later-verification-heading"
          className="bg-pool-50 rounded-xl p-5 sm:p-6"
        >
          <h3
            id="later-verification-heading"
            className="text-pool-950 text-lg font-semibold"
          >
            Requires later verification
          </h3>
          <p className="text-pool-700 mt-2 max-w-3xl text-sm leading-6">
            These normal later-stage checks do not make the desktop assessment
            incomplete.
          </p>
          <ul className="text-pool-700 mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            {report.laterVerification.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden="true" className="text-pool-400">
                  •
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="next-steps-heading">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <h3
              id="next-steps-heading"
              className="text-pool-950 text-xl font-semibold tracking-[-0.02em]"
            >
              Recommended next steps
            </h3>
            <p className="text-pool-blue-800 text-sm font-semibold">
              Next stage: {report.overall.recommendedStage}
            </p>
          </div>
          <ol className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {report.nextSteps.map((step, index) => (
              <li key={step.id} className="flex gap-3">
                <span className="bg-pool-blue-50 text-pool-blue-800 grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold">
                  {index + 1}
                </span>
                <div>
                  <h4 className="text-pool-950 font-semibold">{step.title}</h4>
                  <p className="text-pool-700 mt-1 text-sm leading-6">
                    {step.summary}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="mapping-information-heading">
          <h3
            id="mapping-information-heading"
            className="text-pool-950 text-lg font-semibold"
          >
            Mapping & data information
          </h3>
          <p className="text-pool-700 mt-2 max-w-3xl text-sm leading-6">
            This saved assessment uses mapped information from{" "}
            {providerSummary(report)}. Mapped information is indicative and may
            differ from site conditions.
          </p>
          <details className="border-pool-200 open:bg-pool-50 mt-4 rounded-xl border bg-white">
            <summary className="text-pool-900 focus-visible:outline-pool-blue-700 min-h-11 cursor-pointer px-4 py-3 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2">
              View detailed sources
            </summary>
            <div className="border-pool-200 border-t px-4 py-4">
              <ul className="text-pool-700 space-y-4 text-sm">
                {report.sources.map((source) => (
                  <li key={`${source.provider}-${source.dataset}`}>
                    <p className="text-pool-950 font-semibold">
                      {source.dataset}
                    </p>
                    <p>
                      {source.provider} ·{" "}
                      {(source.queryStatus ?? "unavailable").replaceAll(
                        "_",
                        " ",
                      )}
                      {source.retrievedAt
                        ? ` · Retrieved ${formatSourceDate(source.retrievedAt)}`
                        : ""}
                    </p>
                    {source.attribution && <p>{source.attribution}</p>}
                    {source.sourceUrl && (
                      <a
                        href={source.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-pool-blue-800 font-medium break-all underline underline-offset-2"
                      >
                        Source information
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </section>

        <section
          aria-labelledby="preliminary-assessment-heading"
          className="border-pool-200 text-pool-600 border-t pt-6 text-sm leading-6"
        >
          <h3
            id="preliminary-assessment-heading"
            className="text-pool-900 font-semibold"
          >
            Preliminary assessment
          </h3>
          <p className="mt-2 max-w-4xl">
            This report uses publicly available mapped information for
            preliminary planning purposes. Property boundaries, infrastructure
            locations, terrain and other mapped information are indicative and
            may differ from actual site conditions.
          </p>
          <p className="mt-2 max-w-4xl">
            This report does not constitute surveying, engineering, geotechnical
            advice, utility locating, building consent, resource consent or
            approval to undertake construction. Relevant conditions and
            infrastructure should be independently verified before final design,
            excavation or construction.
          </p>
        </section>

        {onStartAgain && (
          <div className="border-pool-200 flex justify-center border-t pt-6">
            <button
              type="button"
              onClick={onStartAgain}
              className="border-pool-300 text-pool-800 hover:bg-pool-50 focus-visible:outline-pool-blue-700 min-h-11 rounded-xl border bg-white px-5 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Start again
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function AssessmentSection({ assessment }: { assessment: ReportAssessment }) {
  return (
    <article className="grid gap-3 py-5 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-8">
      <div>
        <h4 className="text-pool-950 font-semibold">{assessment.title}</h4>
        <p
          className={`mt-1 text-sm font-bold ${statusTextClasses(assessment.status)}`}
        >
          {assessmentStatusLabel(assessment.status)}
        </p>
      </div>
      <div>
        <p className="text-pool-700 max-w-3xl text-sm leading-6">
          {assessment.summary}
        </p>
        {assessment.details.length > 0 && (
          <dl className="mt-3 grid max-w-2xl gap-2 text-sm sm:grid-cols-2">
            {assessment.details.map((detail) => (
              <div
                key={detail.label}
                className="border-pool-200 flex justify-between gap-4 border-t pt-2"
              >
                <dt className="text-pool-600">{detail.label}</dt>
                <dd className="text-pool-900 text-right font-semibold">
                  {detail.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {assessment.technicalDetails.length > 0 && (
          <details className="mt-3 max-w-2xl">
            <summary className="text-pool-blue-800 focus-visible:outline-pool-blue-700 min-h-11 cursor-pointer py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2">
              View technical details
            </summary>
            <dl className="bg-pool-50 grid gap-2 rounded-lg p-4 text-sm">
              {assessment.technicalDetails.map((detail) => (
                <div
                  key={`${detail.label}-${detail.value}`}
                  className="grid gap-1 sm:grid-cols-[12rem_minmax(0,1fr)]"
                >
                  <dt className="text-pool-600 font-medium">{detail.label}</dt>
                  <dd className="text-pool-800">{detail.value}</dd>
                </div>
              ))}
            </dl>
          </details>
        )}
      </div>
    </article>
  );
}

function statusPanelClasses(status: AssessmentStatus) {
  if (status === "green")
    return "border-pool-blue-200 bg-pool-blue-50 text-pool-blue-950";
  if (status === "amber") return "border-amber-200 bg-amber-50 text-amber-950";
  if (status === "red") return "border-red-200 bg-red-50 text-red-950";
  return "border-pool-300 bg-pool-100 text-pool-900";
}

function statusTextClasses(status: AssessmentStatus) {
  if (status === "green") return "text-pool-blue-800";
  if (status === "amber") return "text-amber-800";
  if (status === "red") return "text-red-800";
  return "text-pool-600";
}

function providerSummary(report: SavedPreliminaryReport) {
  const providers = [
    ...new Set(report.sources.map((source) => source.provider)),
  ];
  return providers.length > 0
    ? providers.join(", ")
    : "the available saved sources";
}

function compactAttribution(report: SavedPreliminaryReport) {
  const attributions = [
    ...new Set(
      report.sources
        .map((source) => source.attribution)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  return attributions.length > 0
    ? attributions.join(" · ")
    : "Mapped information is indicative.";
}

function formatSourceDate(value: string) {
  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Pacific/Auckland",
  }).format(new Date(value));
}
