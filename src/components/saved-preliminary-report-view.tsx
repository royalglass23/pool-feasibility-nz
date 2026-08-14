"use client";

import Image from "next/image";
import { useState } from "react";
import type { SavedPreliminaryReport } from "@/modules/reporting/preliminary-report";
import {
  formatReportBoundaryArea,
  formatReportGeneratedAt,
  humanizeReportValue,
  reportMapLegend,
  reportRecommendations,
  reportWarningLabel,
} from "@/modules/reporting/preliminary-report-presentation";

const pdfDownloadsEnabled = false;

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
  const [downloading] = useState(false);
  const [downloadError] = useState<string | null>(null);
  const [deliveryState] = useState(delivery);
  const [recipientVerificationRequired] = useState(false);
  const mapLegend = reportMapLegend(report);

  return (
    <section
      aria-labelledby="saved-report-heading"
      className="border-pool-200 space-y-6 rounded-3xl border bg-white p-5 shadow-sm sm:p-8"
    >
      <div className="border-pool-200 flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-pool-blue-700 text-xs font-bold tracking-[0.16em] uppercase">
            {report.reference}
          </p>
          <h2
            id="saved-report-heading"
            className="text-pool-950 mt-2 text-2xl font-semibold sm:text-3xl"
          >
            Preliminary pool feasibility report
          </h2>
          <p className="text-pool-700 mt-2">{report.property.address}</p>
          <p className="text-pool-500 mt-1 text-sm">
            Generated {formatReportGeneratedAt(report.generatedAt)}
          </p>
        </div>
        <div className="flex w-full flex-wrap justify-center gap-2 sm:w-auto sm:justify-end">
          <button
            type="button"
            onClick={onBack}
            className="border-pool-300 text-pool-800 min-h-10 rounded-xl border px-4 font-semibold"
          >
            Back to assessment
          </button>
          {pdfDownloadsEnabled && downloadAccessToken && (
            <button
              type="button"
              disabled
              className="bg-pool-950 disabled:bg-pool-500 inline-flex min-h-10 items-center justify-center rounded-xl px-4 font-semibold text-white"
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

      {recipientVerificationRequired && (
        <p className="text-pool-blue-800 text-center text-sm font-semibold">
          Check your email to confirm your address before we send the PDF.
        </p>
      )}

      <p className="text-pool-blue-800 text-center text-sm font-semibold">
        We will email a summary of this preliminary report shortly. Check Spam
        or Promotions if it is not in your inbox.
      </p>

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
        className="border-pool-blue-200 bg-pool-blue-50 rounded-2xl border p-5"
      >
        <h3
          id="saved-report-main-recommendation-heading"
          className="text-pool-blue-800 text-sm font-bold tracking-wide uppercase"
        >
          Main recommendation
        </h3>
        <p className="text-pool-blue-950 mt-2 text-lg font-semibold">
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

      <figure className="border-pool-200 grid overflow-hidden rounded-2xl border bg-white lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Image
          src={report.mapImageDataUrl}
          alt="Saved property and pool map"
          width={1200}
          height={800}
          unoptimized
          className="h-auto w-full object-contain lg:self-center"
        />
        <figcaption className="border-pool-200 bg-pool-50 border-t px-4 py-3 lg:border-t-0 lg:border-l lg:px-5 lg:py-5">
          <p className="text-pool-950 text-sm font-semibold">Map layers</p>
          <ul
            className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1"
            role="list"
          >
            {mapLegend.entries.map((entry) => (
              <li
                key={entry.id}
                className={`flex items-center gap-2 text-sm font-medium ${entry.statusLabel === "Mapped" || !entry.statusLabel ? "text-pool-700" : "text-pool-500"}`}
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
                    <small className="text-pool-500 block text-xs font-normal">
                      {entry.statusLabel}
                    </small>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {mapLegend.excludedLayers.length > 0 && (
            <p className="text-pool-600 mt-3 text-sm leading-6">
              <b className="text-pool-800">Not reproduced in this report:</b>{" "}
              {mapLegend.excludedLayers.join(", ")}. These live reference layers
              remain excluded until report reuse is cleared.
            </p>
          )}
        </figcaption>
      </figure>

      <section aria-labelledby="saved-report-scenarios-heading">
        <h3
          id="saved-report-scenarios-heading"
          className="text-pool-950 text-lg font-semibold"
        >
          Scenario results
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {report.scenarios.map((scenario) => (
            <div
              key={scenario.label}
              className="border-pool-200 rounded-xl border p-4"
            >
              <p className="text-pool-950 font-semibold">{scenario.label}</p>
              <p className="text-pool-700 mt-1 text-sm">
                {humanizeReportValue(scenario.status)}
              </p>
              <p className="text-pool-500 mt-1 text-xs">
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
          className="text-pool-950 text-lg font-semibold"
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
            <p className="text-pool-600 text-sm">
              No additional warning was recorded.
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="saved-report-recommendations-heading">
        <h3
          id="saved-report-recommendations-heading"
          className="text-pool-950 text-lg font-semibold"
        >
          Recommendations
        </h3>
        <ol className="text-pool-700 mt-3 list-decimal space-y-3 pl-5 text-sm leading-6">
          {reportRecommendations(report).map((recommendation) => (
            <li key={`${recommendation.priority}-${recommendation.title}`}>
              <b className="text-pool-950">{recommendation.title}:</b>{" "}
              {recommendation.reason}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="saved-report-categories-heading">
        <h3
          id="saved-report-categories-heading"
          className="text-pool-950 text-lg font-semibold"
        >
          Feasibility category status
        </h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-2xl border-collapse text-left text-sm">
            <thead>
              <tr className="border-pool-300 text-pool-600 border-b">
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
                  className="border-pool-200 border-b align-top"
                >
                  <td className="text-pool-950 p-3 font-semibold">
                    {humanizeReportValue(category.id)}
                  </td>
                  <td className="p-3">
                    {humanizeReportValue(category.status)}
                  </td>
                  <td className="p-3">
                    {category.awardedPoints ?? "—"} / {category.maximumPoints}
                  </td>
                  <td className="text-pool-700 p-3">{category.rationale}</td>
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
            className="text-pool-950 text-lg font-semibold"
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
              <p className="text-pool-600 text-sm">
                No additional material risk was recorded.
              </p>
            )}
          </div>
        </div>
        <div>
          <h3 className="text-pool-950 text-lg font-semibold">
            Prioritised actions
          </h3>
          {report.actions.length > 0 ? (
            <ul className="text-pool-700 mt-3 space-y-3 text-sm">
              {report.actions.flatMap((group) =>
                group.items.map((item) => (
                  <li
                    key={`${group.phase}-${item}`}
                    className="border-pool-200 rounded-xl border p-4"
                  >
                    <b className="text-pool-500 block text-xs tracking-wide uppercase">
                      {humanizeReportValue(group.phase)}
                    </b>
                    <span className="mt-1 block">{item}</span>
                  </li>
                )),
              )}
            </ul>
          ) : (
            <p className="text-pool-600 mt-3 text-sm">
              No additional action was recorded.
            </p>
          )}
          <h3 className="text-pool-950 mt-6 text-lg font-semibold">
            Missing information
          </h3>
          <ul className="text-pool-700 mt-3 list-disc space-y-1 pl-5 text-sm">
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
          className="text-pool-950 text-lg font-semibold"
        >
          Official layer status
        </h3>
        {report.layers.length > 0 ? (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {report.layers.map((layer) => (
              <li
                key={`${layer.provider}-${layer.dataset}`}
                className="border-pool-200 rounded-xl border p-4 text-sm"
              >
                <b className="text-pool-950">{layer.dataset}</b>
                <span className="text-pool-600 block">
                  {layer.provider} · {humanizeReportValue(layer.state)} ·{" "}
                  {humanizeReportValue(layer.confidence)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-pool-600 mt-3 text-sm">
            Detailed official checks have not been loaded.
          </p>
        )}
      </section>

      <section aria-labelledby="saved-report-sources-heading">
        <h3
          id="saved-report-sources-heading"
          className="text-pool-950 text-lg font-semibold"
        >
          Data sources and map attribution
        </h3>
        {report.sources.length > 0 ? (
          <ul className="text-pool-700 mt-3 space-y-3 text-sm">
            {report.sources.map((source) => (
              <li
                key={`${source.provider}-${source.dataset}`}
                className="border-pool-200 rounded-xl border p-4"
              >
                <b className="text-pool-950">{source.dataset}</b>
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
                    className="text-pool-blue-700 block break-all underline"
                  >
                    {source.sourceUrl}
                  </a>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-pool-600 mt-3 text-sm">
            No report-eligible source attribution was recorded.
          </p>
        )}
      </section>

      <div className="bg-pool-50 text-pool-700 rounded-xl p-4 text-sm leading-6">
        <p className="text-pool-950 font-semibold">Assumptions</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {report.assumptions.map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
        </ul>
        <p className="text-pool-950 font-semibold">Limitations</p>
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
    <div className="border-pool-200 rounded-xl border p-4">
      <p className="text-pool-500 text-xs font-bold tracking-wide uppercase">
        {label}
      </p>
      <p className="text-pool-950 mt-2 font-semibold">{value}</p>
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
