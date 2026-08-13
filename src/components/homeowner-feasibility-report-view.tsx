"use client";

import { useEffect, useState } from "react";
import { SavedReportInteractiveMap } from "@/components/saved-report-interactive-map";
import type { ReportDeliveryState } from "@/components/saved-preliminary-report-view";
import {
  preliminaryReportFilename,
  type SavedPreliminaryReport,
} from "@/modules/reporting/preliminary-report";
import {
  assessmentStatusLabel,
  formatReportNumber,
  REPORT_ASSESSMENT_ORDER,
  reportShortStatus,
  reportStatusName,
  type AssessmentStatus,
  type ReportAssessment,
} from "@/modules/reporting/pool-feasibility-report";
import { formatReportGeneratedAt } from "@/modules/reporting/preliminary-report-presentation";

export function HomeownerFeasibilityReportView({
  report,
  delivery,
  onBack,
  downloadAccessToken,
}: {
  report: SavedPreliminaryReport;
  delivery: {
    homeowner: ReportDeliveryState;
    internal_test_report: ReportDeliveryState;
  };
  onBack: () => void;
  downloadAccessToken?: string;
}) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [deliveryState, setDeliveryState] = useState(delivery);
  const [sending, setSending] = useState(false);

  async function deliverReport() {
    if (!downloadAccessToken || sending) return;
    setSending(true);
    setDeliveryError(null);
    try {
      const response = await fetch("/api/public/assessments/report/delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: downloadAccessToken }),
      });
      const body = (await response.json().catch(() => null)) as {
        delivery?: {
          homeowner: ReportDeliveryState;
          internal_test_report: ReportDeliveryState;
        };
        error?: { message?: string };
      } | null;
      if (!response.ok || !body?.delivery) {
        throw new Error(
          body?.error?.message ?? "Email delivery could not complete.",
        );
      }
      setDeliveryState(body.delivery);
    } catch (error) {
      setDeliveryError(
        error instanceof Error
          ? error.message
          : "Email delivery could not complete.",
      );
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    if (
      !downloadAccessToken ||
      (delivery.homeowner !== "pending" && delivery.homeowner !== "sending")
    ) {
      return;
    }
    const controller = new AbortController();
    void fetch("/api/public/assessments/report/delivery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: downloadAccessToken }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as {
          delivery?: {
            homeowner: ReportDeliveryState;
            internal_test_report: ReportDeliveryState;
          };
          error?: { message?: string };
        } | null;
        if (!response.ok || !body?.delivery) {
          throw new Error(
            body?.error?.message ?? "Email delivery could not complete.",
          );
        }
        return body.delivery;
      })
      .then((nextDelivery) => setDeliveryState(nextDelivery))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setDeliveryError(
          error instanceof Error
            ? error.message
            : "Email delivery could not complete.",
        );
      });
    return () => controller.abort();
  }, [delivery.homeowner, downloadAccessToken]);

  async function downloadPdf() {
    if (!downloadAccessToken || downloading) return;
    setDownloading(true);
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
          body?.error?.message ?? "The PDF could not be downloaded.",
        );
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = preliminaryReportFilename(report);
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setDownloadError(
        error instanceof Error
          ? error.message
          : "The PDF could not be downloaded.",
      );
    } finally {
      setDownloading(false);
    }
  }

  const homeownerDelivery = deliveryState.homeowner;

  return (
    <article
      aria-labelledby="saved-report-heading"
      className="mx-auto w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm"
    >
      <header className="border-b border-slate-200 px-5 py-5 sm:px-8 lg:px-10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="font-mono text-xs font-semibold text-slate-500">
              {report.reference}
            </p>
            <h2
              id="saved-report-heading"
              className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-3xl"
            >
              Preliminary Pool Feasibility Report
            </h2>
            <p className="mt-2 text-base font-medium text-slate-800">
              {report.property.address}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Proposed pool: {formatReportNumber(report.pool.lengthMetres)} x{" "}
              {formatReportNumber(report.pool.widthMetres)} m · Generated{" "}
              {formatReportGeneratedAt(report.generatedAt)}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row lg:justify-end">
            <button
              type="button"
              onClick={onBack}
              className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 font-semibold text-slate-800 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              Back to assessment
            </button>
            {downloadAccessToken && (
              <button
                type="button"
                onClick={() => void downloadPdf()}
                disabled={downloading}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-5 font-semibold text-white transition-colors hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-wait disabled:bg-slate-500"
              >
                {downloading ? "Preparing PDF..." : "Download PDF"}
              </button>
            )}
          </div>
        </div>

        {(downloadError || deliveryError) && (
          <p role="alert" className="mt-4 text-sm font-semibold text-red-700">
            {downloadError ?? deliveryError}
          </p>
        )}

        {downloadAccessToken && (
          <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className={deliveryTextClasses(homeownerDelivery)}>
              {homeownerDelivery === "sent"
                ? "Report emailed to the client."
                : homeownerDelivery === "failed"
                  ? "Report generated successfully. Email delivery failed."
                  : "Emailing the saved report to the client..."}
            </p>
            {homeownerDelivery === "failed" && (
              <button
                type="button"
                onClick={() => void deliverReport()}
                disabled={sending}
                className="min-h-11 self-start rounded-xl border border-slate-300 px-4 font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-wait disabled:text-slate-500"
              >
                {sending ? "Retrying..." : "Resend report"}
              </button>
            )}
          </div>
        )}
      </header>

      <div className="space-y-10 px-5 py-7 sm:px-8 lg:px-10 lg:py-10">
        <section
          aria-labelledby="overall-result-heading"
          className={`rounded-2xl border p-5 sm:p-6 ${statusPanelClasses(report.overall.status)}`}
        >
          <p className="text-sm font-bold">
            {reportStatusName(report.overall.status)} -{" "}
            {report.overall.headline}
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
              className="text-xl font-semibold tracking-[-0.02em] text-slate-950"
            >
              At a glance
            </h3>
            <p className="text-sm text-slate-600">
              Status is always shown in words as well as colour.
            </p>
          </div>
          <dl className="mt-4 overflow-hidden rounded-xl border border-slate-200 sm:grid sm:grid-cols-2">
            {REPORT_ASSESSMENT_ORDER.map((id) => {
              const item = report.assessments[id];
              return (
                <div
                  key={id}
                  className="flex min-h-14 items-center justify-between gap-4 border-b border-slate-200 px-4 py-3 last:border-b-0 sm:[&:nth-child(odd)]:border-r sm:[&:nth-last-child(-n+2)]:border-b-0"
                >
                  <dt className="font-semibold text-slate-900">{item.title}</dt>
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
                className="text-xl font-semibold tracking-[-0.02em] text-slate-950"
              >
                Assessment map
              </h3>
              <p className="mt-1 text-sm text-slate-600">
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
            className="text-xl font-semibold tracking-[-0.02em] text-slate-950"
          >
            Key findings
          </h3>
          <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200">
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
                  <h4 className="font-semibold text-slate-950">
                    {finding.title}
                  </h4>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-700">
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
            className="text-xl font-semibold tracking-[-0.02em] text-slate-950"
          >
            Site assessment
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Approximate mapped information supports early planning only. Open
            technical details only when you need the saved source context.
          </p>
          <div className="mt-5 divide-y divide-slate-200 border-y border-slate-200">
            {REPORT_ASSESSMENT_ORDER.map((id) => (
              <AssessmentSection key={id} assessment={report.assessments[id]} />
            ))}
          </div>
        </section>

        <section
          aria-labelledby="later-verification-heading"
          className="rounded-xl bg-slate-50 p-5 sm:p-6"
        >
          <h3
            id="later-verification-heading"
            className="text-lg font-semibold text-slate-950"
          >
            Requires later verification
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
            These normal later-stage checks do not make the desktop assessment
            incomplete.
          </p>
          <ul className="mt-4 grid gap-x-8 gap-y-2 text-sm text-slate-700 sm:grid-cols-2">
            {report.laterVerification.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden="true" className="text-slate-400">
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
              className="text-xl font-semibold tracking-[-0.02em] text-slate-950"
            >
              Recommended next steps
            </h3>
            <p className="text-sm font-semibold text-teal-800">
              Next stage: {report.overall.recommendedStage}
            </p>
          </div>
          <ol className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {report.nextSteps.map((step, index) => (
              <li key={step.id} className="flex gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal-50 text-sm font-bold text-teal-800">
                  {index + 1}
                </span>
                <div>
                  <h4 className="font-semibold text-slate-950">{step.title}</h4>
                  <p className="mt-1 text-sm leading-6 text-slate-700">
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
            className="text-lg font-semibold text-slate-950"
          >
            Mapping & data information
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
            This saved assessment uses mapped information from{" "}
            {providerSummary(report)}. Mapped information is indicative and may
            differ from site conditions.
          </p>
          <details className="mt-4 rounded-xl border border-slate-200 bg-white open:bg-slate-50">
            <summary className="min-h-11 cursor-pointer px-4 py-3 font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">
              View detailed sources
            </summary>
            <div className="border-t border-slate-200 px-4 py-4">
              <ul className="space-y-4 text-sm text-slate-700">
                {report.sources.map((source) => (
                  <li key={`${source.provider}-${source.dataset}`}>
                    <p className="font-semibold text-slate-950">
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
                        className="font-medium break-all text-teal-800 underline underline-offset-2"
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
          className="border-t border-slate-200 pt-6 text-sm leading-6 text-slate-600"
        >
          <h3
            id="preliminary-assessment-heading"
            className="font-semibold text-slate-900"
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
      </div>
    </article>
  );
}

function AssessmentSection({ assessment }: { assessment: ReportAssessment }) {
  return (
    <article className="grid gap-3 py-5 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-8">
      <div>
        <h4 className="font-semibold text-slate-950">{assessment.title}</h4>
        <p
          className={`mt-1 text-sm font-bold ${statusTextClasses(assessment.status)}`}
        >
          {assessmentStatusLabel(assessment.status)}
        </p>
      </div>
      <div>
        <p className="max-w-3xl text-sm leading-6 text-slate-700">
          {assessment.summary}
        </p>
        {assessment.details.length > 0 && (
          <dl className="mt-3 grid max-w-2xl gap-2 text-sm sm:grid-cols-2">
            {assessment.details.map((detail) => (
              <div
                key={detail.label}
                className="flex justify-between gap-4 border-t border-slate-200 pt-2"
              >
                <dt className="text-slate-600">{detail.label}</dt>
                <dd className="text-right font-semibold text-slate-900">
                  {detail.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {assessment.technicalDetails.length > 0 && (
          <details className="mt-3 max-w-2xl">
            <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">
              View technical details
            </summary>
            <dl className="grid gap-2 rounded-lg bg-slate-50 p-4 text-sm">
              {assessment.technicalDetails.map((detail) => (
                <div
                  key={`${detail.label}-${detail.value}`}
                  className="grid gap-1 sm:grid-cols-[12rem_minmax(0,1fr)]"
                >
                  <dt className="font-medium text-slate-600">{detail.label}</dt>
                  <dd className="text-slate-800">{detail.value}</dd>
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
  if (status === "green") return "border-teal-200 bg-teal-50 text-teal-950";
  if (status === "amber") return "border-amber-200 bg-amber-50 text-amber-950";
  if (status === "red") return "border-red-200 bg-red-50 text-red-950";
  return "border-slate-300 bg-slate-100 text-slate-900";
}

function statusTextClasses(status: AssessmentStatus) {
  if (status === "green") return "text-teal-800";
  if (status === "amber") return "text-amber-800";
  if (status === "red") return "text-red-800";
  return "text-slate-600";
}

function deliveryTextClasses(state: ReportDeliveryState) {
  if (state === "sent") return "font-semibold text-teal-800";
  if (state === "failed") return "font-semibold text-red-700";
  return "font-semibold text-slate-600";
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
