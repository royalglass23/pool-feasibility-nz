"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { SavedPreliminaryReport } from "@/modules/reporting/preliminary-report";
import {
  formatReportBoundaryArea,
  formatReportGeneratedAt,
  humanizeReportValue,
  reportMapLegend,
  reportRecommendations,
  reportWarningLabel,
} from "@/modules/reporting/preliminary-report-presentation";
import { ActionProgressDialog } from "@/components/action-progress-dialog";

export type ReportDeliveryState = "pending" | "sending" | "sent" | "failed";

export function SavedPreliminaryReportView({
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
  const [deliveryState, setDeliveryState] = useState(delivery);
  const mapLegend = reportMapLegend(report);

  useEffect(() => {
    if (!downloadAccessToken) return;
    const controller = new AbortController();
    void fetch("/api/public/assessments/report/delivery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: downloadAccessToken }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as {
          delivery?: {
            homeowner: ReportDeliveryState;
            internal_test_report: ReportDeliveryState;
          };
        };
      })
      .then((body) => {
        if (body?.delivery) setDeliveryState(body.delivery);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [downloadAccessToken]);

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
      anchor.download = `pool-feasibility-${report.reference}.pdf`;
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

  return (
    <section
      aria-labelledby="saved-report-heading"
      className="space-y-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8"
    >
      <ActionProgressDialog
        open={downloading}
        title="Preparing your PDF"
        description="Generating your preliminary property assessment report."
      />
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold tracking-[0.16em] text-teal-700 uppercase">
            {report.reference}
          </p>
          <h2
            id="saved-report-heading"
            className="mt-2 text-2xl font-semibold text-slate-950 sm:text-3xl"
          >
            Preliminary pool feasibility report
          </h2>
          <p className="mt-2 text-slate-700">{report.property.address}</p>
          <p className="mt-1 text-sm text-slate-500">
            Generated {formatReportGeneratedAt(report.generatedAt)}
          </p>
        </div>
        <div className="flex w-full flex-wrap justify-center gap-2 sm:w-auto sm:justify-end">
          <button
            type="button"
            onClick={onBack}
            className="min-h-10 rounded-xl border border-slate-300 px-4 font-semibold text-slate-800"
          >
            Back to assessment
          </button>
          {downloadAccessToken && (
            <button
              type="button"
              onClick={() => void downloadPdf()}
              disabled={downloading}
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-slate-950 px-4 font-semibold text-white disabled:bg-slate-500"
            >
              {downloading ? "Preparing PDF…" : "Download PDF"}
            </button>
          )}
        </div>
      </div>

      {downloadError && (
        <p
          role="alert"
          className="text-center text-sm font-semibold text-red-700"
        >
          {downloadError}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <DeliveryStatus
          label="Homeowner email"
          state={deliveryState.homeowner}
        />
        <DeliveryStatus
          label="Internal report email"
          state={deliveryState.internal_test_report}
        />
      </div>

      <section
        aria-labelledby="saved-report-main-recommendation-heading"
        className="rounded-2xl border border-teal-200 bg-teal-50 p-5"
      >
        <h3
          id="saved-report-main-recommendation-heading"
          className="text-sm font-bold tracking-wide text-teal-800 uppercase"
        >
          Main recommendation
        </h3>
        <p className="mt-2 text-lg font-semibold text-teal-950">
          {report.mainRecommendation}
        </p>
      </section>

      <div
        className={`rounded-2xl border p-5 ${warningClasses(report.warningState)}`}
      >
        <p className="text-xs font-bold tracking-wide uppercase">
          {reportWarningLabel(report.warningState)}
        </p>
        <p className="mt-2 font-semibold">{report.summary}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Fact
          label="Feasibility score"
          value={report.decision.score?.toString() ?? "Not scored"}
        />
        <Fact
          label="Classification / confidence"
          value={`${humanizeReportValue(report.decision.classification)} · ${humanizeReportValue(report.decision.confidence)}`}
        />
        <Fact
          label="Mapped boundary / area"
          value={`Status: ${humanizeReportValue(report.property.boundaryStatus)} · Confidence: ${humanizeReportValue(report.property.boundaryConfidence)} · Area: ${formatReportBoundaryArea(report.property.boundaryAreaSquareMetres)}${report.property.parcelIdentifier ? ` · ${report.property.parcelIdentifier}` : ""}`}
        />
        <Fact
          label="Selected pool"
          value={`${report.pool.lengthMetres} m × ${report.pool.widthMetres} m`}
        />
        <Fact label="Rotation" value={`${report.pool.rotationDegrees}°`} />
      </div>

      <figure className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Image
          src={report.mapImageDataUrl}
          alt="Saved property and pool map"
          width={1200}
          height={800}
          unoptimized
          className="h-auto w-full object-contain lg:self-center"
        />
        <figcaption className="border-t border-slate-200 bg-slate-50 px-4 py-3 lg:border-t-0 lg:border-l lg:px-5 lg:py-5">
          <p className="text-sm font-semibold text-slate-950">Map layers</p>
          <ul
            className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1"
            role="list"
          >
            {mapLegend.entries.map((entry) => (
              <li
                key={entry.id}
                className={`flex items-center gap-2 text-sm font-medium ${entry.statusLabel === "Mapped" || !entry.statusLabel ? "text-slate-700" : "text-slate-500"}`}
              >
                <span
                  aria-hidden="true"
                  className={`inline-block w-8 shrink-0 ${
                    entry.kind === "area" ? "h-3" : "h-0"
                  }`}
                  style={
                    entry.kind === "area"
                      ? {
                          backgroundColor: `${entry.colour}38`,
                          boxShadow: `inset 0 0 0 2px ${entry.colour}`,
                        }
                      : {
                          borderTop: `3px ${entry.dashed ? "dashed" : "solid"} ${entry.colour}`,
                        }
                  }
                />
                <span>
                  {entry.label}
                  {entry.statusLabel && (
                    <small className="block text-xs font-normal text-slate-500">
                      {entry.statusLabel}
                    </small>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {mapLegend.excludedLayers.length > 0 && (
            <p className="mt-3 text-sm leading-6 text-slate-600">
              <b className="text-slate-800">Not reproduced in this report:</b>{" "}
              {mapLegend.excludedLayers.join(", ")}. These live reference layers
              remain excluded until report reuse is cleared.
            </p>
          )}
        </figcaption>
      </figure>

      <section aria-labelledby="saved-report-scenarios-heading">
        <h3
          id="saved-report-scenarios-heading"
          className="text-lg font-semibold text-slate-950"
        >
          Scenario results
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {report.scenarios.map((scenario) => (
            <div
              key={scenario.label}
              className="rounded-xl border border-slate-200 p-4"
            >
              <p className="font-semibold text-slate-950">{scenario.label}</p>
              <p className="mt-1 text-sm text-slate-700">
                {humanizeReportValue(scenario.status)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {scenario.usableAreaSquareMetres === null
                  ? "Usable area unavailable"
                  : `${scenario.usableAreaSquareMetres} m² usable area`}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="saved-report-warnings-heading">
        <h3
          id="saved-report-warnings-heading"
          className="text-lg font-semibold text-slate-950"
        >
          Warnings
        </h3>
        <div className="mt-3 space-y-3">
          {report.warnings.length > 0 ? (
            report.warnings.map((warning) => (
              <div
                key={warning.code}
                className="rounded-xl border border-amber-200 bg-amber-50 p-4"
              >
                <p className="font-semibold text-amber-950">{warning.title}</p>
                <p className="mt-1 text-sm leading-6 text-amber-900">
                  {warning.message}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-600">
              No additional warning was recorded.
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="saved-report-recommendations-heading">
        <h3
          id="saved-report-recommendations-heading"
          className="text-lg font-semibold text-slate-950"
        >
          Recommendations
        </h3>
        <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-6 text-slate-700">
          {reportRecommendations(report).map((recommendation) => (
            <li key={`${recommendation.priority}-${recommendation.title}`}>
              <b className="text-slate-950">{recommendation.title}:</b>{" "}
              {recommendation.reason}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="saved-report-categories-heading">
        <h3
          id="saved-report-categories-heading"
          className="text-lg font-semibold text-slate-950"
        >
          Feasibility category status
        </h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-2xl border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-slate-600">
                <th className="p-3">Category</th>
                <th className="p-3">Status</th>
                <th className="p-3">Score</th>
                <th className="p-3">Rationale</th>
              </tr>
            </thead>
            <tbody>
              {report.categories.map((category) => (
                <tr
                  key={category.id}
                  className="border-b border-slate-200 align-top"
                >
                  <td className="p-3 font-semibold text-slate-950">
                    {humanizeReportValue(category.id)}
                  </td>
                  <td className="p-3">
                    {humanizeReportValue(category.status)}
                  </td>
                  <td className="p-3">
                    {category.awardedPoints ?? "—"} / {category.maximumPoints}
                  </td>
                  <td className="p-3 text-slate-700">{category.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section
        aria-labelledby="saved-report-risks-actions-heading"
        className="grid gap-6 lg:grid-cols-2"
      >
        <div>
          <h3
            id="saved-report-risks-actions-heading"
            className="text-lg font-semibold text-slate-950"
          >
            Material risks
          </h3>
          <div className="mt-3 space-y-3">
            {report.risks.length > 0 ? (
              report.risks.map((risk) => (
                <div
                  key={risk.id}
                  className="rounded-xl border border-amber-200 bg-amber-50 p-4"
                >
                  <p className="font-semibold text-amber-950">{risk.title}</p>
                  <p className="mt-1 text-sm text-amber-900">{risk.evidence}</p>
                  <p className="mt-2 text-sm text-amber-950">
                    <b>Action:</b> {risk.action}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-600">
                No additional material risk was recorded.
              </p>
            )}
          </div>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-950">
            Prioritised actions
          </h3>
          {report.actions.length > 0 ? (
            <ul className="mt-3 space-y-3 text-sm text-slate-700">
              {report.actions.flatMap((group) =>
                group.items.map((item) => (
                  <li
                    key={`${group.phase}-${item}`}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <b className="block text-xs tracking-wide text-slate-500 uppercase">
                      {humanizeReportValue(group.phase)}
                    </b>
                    <span className="mt-1 block">{item}</span>
                  </li>
                )),
              )}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-600">
              No additional action was recorded.
            </p>
          )}
          <h3 className="mt-6 text-lg font-semibold text-slate-950">
            Missing information
          </h3>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {report.missingInformation.length > 0 ? (
              report.missingInformation.map((item) => (
                <li key={item.id}>{item.label}</li>
              ))
            ) : (
              <li>No additional missing-information item was recorded.</li>
            )}
          </ul>
        </div>
      </section>

      <section aria-labelledby="saved-report-layers-heading">
        <h3
          id="saved-report-layers-heading"
          className="text-lg font-semibold text-slate-950"
        >
          Official layer status
        </h3>
        {report.layers.length > 0 ? (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {report.layers.map((layer) => (
              <li
                key={`${layer.provider}-${layer.dataset}`}
                className="rounded-xl border border-slate-200 p-4 text-sm"
              >
                <b className="text-slate-950">{layer.dataset}</b>
                <span className="block text-slate-600">
                  {layer.provider} · {humanizeReportValue(layer.state)} ·{" "}
                  {humanizeReportValue(layer.confidence)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-600">
            Detailed official checks have not been loaded.
          </p>
        )}
      </section>

      <section aria-labelledby="saved-report-sources-heading">
        <h3
          id="saved-report-sources-heading"
          className="text-lg font-semibold text-slate-950"
        >
          Data sources and map attribution
        </h3>
        {report.sources.length > 0 ? (
          <ul className="mt-3 space-y-3 text-sm text-slate-700">
            {report.sources.map((source) => (
              <li
                key={`${source.provider}-${source.dataset}`}
                className="rounded-xl border border-slate-200 p-4"
              >
                <b className="text-slate-950">{source.dataset}</b>
                <span className="block">
                  {source.provider} · {humanizeReportValue(source.status)} ·{" "}
                  {source.licence}
                </span>
                {source.attribution && (
                  <span className="block">{source.attribution}</span>
                )}
                {source.sourceUrl && (
                  <a
                    href={source.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block break-all text-teal-700 underline"
                  >
                    {source.sourceUrl}
                  </a>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-600">
            No report-eligible source attribution was recorded.
          </p>
        )}
      </section>

      <div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
        <p className="font-semibold text-slate-950">Assumptions</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {report.assumptions.map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
        </ul>
        <p className="font-semibold text-slate-950">Limitations</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {report.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
        <p className="mt-3 font-semibold">
          This preliminary assessment is not approval, engineering design, a
          survey, title advice, utility location, or an approved pool position.
        </p>
      </div>
    </section>
  );
}

function DeliveryStatus({
  label,
  state,
}: {
  label: string;
  state: ReportDeliveryState;
}) {
  return (
    <p
      className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
        state === "failed"
          ? "border-red-200 bg-red-50 text-red-800"
          : state === "sent"
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-blue-200 bg-blue-50 text-blue-800"
      }`}
    >
      {label}: {deliveryLabel(state)}
    </p>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
        {label}
      </p>
      <p className="mt-2 font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function deliveryLabel(state: ReportDeliveryState) {
  if (state === "sent") return "Sent";
  if (state === "failed") return "Needs retry";
  return "Processing";
}

function warningClasses(state: SavedPreliminaryReport["warningState"]) {
  if (state === "no_warning")
    return "border-emerald-200 bg-emerald-50 text-emerald-950";
  if (state === "blocked") return "border-red-200 bg-red-50 text-red-950";
  return "border-amber-200 bg-amber-50 text-amber-950";
}
