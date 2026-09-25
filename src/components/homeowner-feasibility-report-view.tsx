"use client";

import { type KeyboardEvent, useId, useRef, useState } from "react";
import { SavedReportInteractiveMap } from "@/components/saved-report-interactive-map";
import type { ReportDeliveryState } from "@/modules/reporting/report-delivery-policy";
import { type SavedPreliminaryReport } from "@/modules/reporting/preliminary-report";
import {
  assessmentStatusLabel,
  formatReportNumber,
  reportShortStatus,
  type AssessmentStatus,
  type ReportAssessment,
} from "@/modules/reporting/pool-feasibility-report";
import {
  formatReportGeneratedAt,
  reportConstructabilitySections,
  type ReportConstructabilitySection,
} from "@/modules/reporting/preliminary-report-presentation";
import {
  PRELIMINARY_FEASIBILITY_READING_GUIDE,
  PRELIMINARY_FEASIBILITY_SCOPE,
} from "@/modules/reporting/preliminary-feasibility-copy";
import { reportWebAudiencePresentation } from "@/modules/reporting/report-audience-presentation";

type ReportViewId = "overview" | "property-findings" | "what-happens-next";

const REPORT_VIEWS: ReadonlyArray<{ id: ReportViewId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "property-findings", label: "Property findings" },
  { id: "what-happens-next", label: "What happens next" },
];

export function HomeownerFeasibilityReportView({
  report,
  builderCompanyName,
  delivery,
  onBack,
  showBackAction = true,
  onStartAgain,
}: {
  report: SavedPreliminaryReport;
  builderCompanyName?: string | null;
  delivery: {
    homeowner: ReportDeliveryState;
    internal_test_report: ReportDeliveryState;
  };
  onBack: () => void;
  showBackAction?: boolean;
  onStartAgain?: () => void;
}) {
  void delivery;
  const audiencePresentation = reportWebAudiencePresentation(
    report.reportAudience,
  );
  const constructabilitySections = reportConstructabilitySections(report);
  const criticalRisks = report.risks.filter(
    (risk) =>
      (risk.severity === "high" || risk.specialistReviewRequired) &&
      !report.keyFindings.some((finding) => finding.id === risk.id),
  );
  const [activeView, setActiveView] = useState<ReportViewId>("overview");
  const tabSetId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function selectView(view: ReportViewId, focus = false) {
    setActiveView(view);
    if (focus) {
      const index = REPORT_VIEWS.findIndex((item) => item.id === view);
      tabRefs.current[index]?.focus();
    }
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const currentIndex = REPORT_VIEWS.findIndex(
      (item) => item.id === activeView,
    );
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % REPORT_VIEWS.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex =
        (currentIndex - 1 + REPORT_VIEWS.length) % REPORT_VIEWS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = REPORT_VIEWS.length - 1;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    selectView(REPORT_VIEWS[nextIndex]!.id, true);
  }

  return (
    <article
      aria-labelledby="saved-report-heading"
      className="border-pool-200 text-pool-900 mx-auto w-full max-w-6xl overflow-hidden rounded-2xl border bg-white shadow-sm"
    >
      <AssessmentReadingGuide />
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
            {report.reportAudience === "pool_builder" && builderCompanyName && (
              <p className="text-pool-700 mt-1 text-sm">
                Company / trading name: {builderCompanyName}
              </p>
            )}
            <p className="text-pool-600 mt-1 text-sm">
              Proposed pool: {formatReportNumber(report.pool.lengthMetres)} x{" "}
              {formatReportNumber(report.pool.widthMetres)} m · Generated{" "}
              {formatReportGeneratedAt(report.generatedAt)}
            </p>
          </div>
          {showBackAction && (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row lg:justify-end">
              <button
                type="button"
                onClick={onBack}
                className="border-pool-300 text-pool-800 hover:bg-pool-50 focus-visible:outline-pool-blue-700 min-h-11 rounded-xl border bg-white px-4 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Back to assessment
              </button>
            </div>
          )}
        </div>

        <p className="text-pool-blue-800 mt-4 text-sm font-semibold">
          We will email a summary of this preliminary report shortly. Check Spam
          or Promotions if it is not in your inbox.
        </p>
      </header>

      <nav
        aria-label="Saved report views"
        className="border-pool-200 border-b px-5 py-4 sm:px-8 lg:px-10"
      >
        <div
          role="tablist"
          aria-label="Saved report views"
          className="grid grid-cols-1 gap-2 sm:grid-cols-3"
        >
          {REPORT_VIEWS.map((view, index) => {
            const selected = activeView === view.id;
            return (
              <button
                key={view.id}
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                id={`${tabSetId}-${view.id}-tab`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`${tabSetId}-${view.id}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => selectView(view.id)}
                onKeyDown={handleTabKeyDown}
                className={`focus-visible:outline-pool-blue-700 min-h-11 rounded-[3px] border px-4 py-2 text-left text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 sm:text-center ${selected ? "border-pool-blue-700 bg-pool-blue-50 text-pool-blue-900" : "border-pool-200 text-pool-700 hover:bg-pool-50 bg-white"}`}
              >
                {view.label}
              </button>
            );
          })}
        </div>
      </nav>

      {activeView === "overview" && (
        <div
          id={`${tabSetId}-overview-panel`}
          role="tabpanel"
          aria-labelledby={`${tabSetId}-overview-tab`}
          tabIndex={0}
          className="space-y-10 px-5 py-7 sm:px-8 lg:px-10 lg:py-10"
        >
          <section
            aria-label="Overall assessment"
            className={`rounded-2xl border p-5 sm:p-6 ${statusPanelClasses(report.overall.status)}`}
          >
            <p className="text-sm font-bold">
              {assessmentStatusLabel(report.overall.status)}
            </p>
            <p className="mt-3 max-w-3xl text-base leading-7">
              {report.overall.summary}
            </p>
            <p className="mt-4 text-sm font-semibold">
              Recommended next stage: {report.overall.recommendedStage}
            </p>
          </section>

          <section
            aria-label="Preliminary feasibility scope"
            className="border-pool-blue-200 bg-pool-blue-50 text-pool-900 rounded-xl border px-5 py-4 text-sm leading-6"
          >
            <strong>Preliminary feasibility only.</strong>{" "}
            {PRELIMINARY_FEASIBILITY_SCOPE}
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
              {audiencePresentation.assessmentIds.map((id) => {
                const item = report.assessments[id];
                return (
                  <div
                    key={id}
                    className="border-pool-200 flex min-h-14 items-center justify-between gap-4 border-b px-4 py-3 last:border-b-0 sm:[&:nth-child(odd)]:border-r sm:[&:nth-last-child(-n+2)]:border-b-0"
                  >
                    <dt className="text-pool-900 font-semibold">
                      {item.title}
                    </dt>
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

          <ReportSafetySummary
            report={report}
            assessmentIds={audiencePresentation.assessmentIds}
            constructabilitySections={constructabilitySections}
            criticalRisks={criticalRisks}
            showTechnicalConstructability={
              audiencePresentation.showTechnicalConstructability
            }
          />
        </div>
      )}

      {activeView === "property-findings" && (
        <div
          id={`${tabSetId}-property-findings-panel`}
          role="tabpanel"
          aria-labelledby={`${tabSetId}-property-findings-tab`}
          tabIndex={0}
          className="space-y-10 px-5 py-7 sm:px-8 lg:px-10 lg:py-10"
        >
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
            <SavedReportInteractiveMap report={report} />
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
              {audiencePresentation.assessmentIds.map((id) => (
                <AssessmentSection
                  key={id}
                  assessment={report.assessments[id]}
                />
              ))}
            </div>
          </section>

          {audiencePresentation.showTechnicalConstructability && (
            <section aria-labelledby="constructability-heading">
              <h3
                id="constructability-heading"
                className="text-pool-950 text-xl font-semibold tracking-[-0.02em]"
              >
                Site constructability
              </h3>
              <p className="text-pool-600 mt-2 max-w-3xl text-sm leading-6">
                These sections reproduce the saved Site answers, mapped
                evidence, route analysis, provider availability and assumptions
                from this assessment. They do not use current provider data.
              </p>
              <div className="mt-5 space-y-4">
                {constructabilitySections.map((section) => (
                  <ConstructabilitySection key={section.id} section={section} />
                ))}
              </div>
            </section>
          )}

          {audiencePresentation.showDetailedSources && (
            <section aria-labelledby="mapping-information-heading">
              <h3
                id="mapping-information-heading"
                className="text-pool-950 text-lg font-semibold"
              >
                Mapping & data information
              </h3>
              <p className="text-pool-700 mt-2 max-w-3xl text-sm leading-6">
                This saved assessment uses mapped information from{" "}
                {providerSummary(report)}. Mapped information is indicative and
                may differ from site conditions.
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
          )}
        </div>
      )}

      {activeView === "what-happens-next" && (
        <div
          id={`${tabSetId}-what-happens-next-panel`}
          role="tabpanel"
          aria-labelledby={`${tabSetId}-what-happens-next-tab`}
          tabIndex={0}
          className="space-y-10 px-5 py-7 sm:px-8 lg:px-10 lg:py-10"
        >
          {audiencePresentation.builderConfirmationItems.length > 0 && (
            <section
              aria-labelledby="builder-confirmation-heading"
              className="bg-pool-50 rounded-xl p-5 sm:p-6"
            >
              <h3
                id="builder-confirmation-heading"
                className="text-pool-950 text-xl font-semibold tracking-[-0.02em]"
              >
                {audiencePresentation.builderConfirmationHeading}
              </h3>
              <ul className="text-pool-700 mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                {audiencePresentation.builderConfirmationItems.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span aria-hidden="true" className="text-pool-400">
                      •
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {audiencePresentation.onsiteNextStep && (
            <section
              aria-labelledby="homeowner-next-step-heading"
              className="border-pool-blue-200 bg-pool-blue-50 rounded-xl border p-5 sm:p-6"
            >
              <h3
                id="homeowner-next-step-heading"
                className="text-pool-950 text-lg font-semibold"
              >
                {audiencePresentation.nextStepHeading}
              </h3>
              <p className="text-pool-950 mt-3 font-semibold">
                {audiencePresentation.onsiteNextStep.action}
              </p>
              <p className="text-pool-700 mt-2 max-w-3xl text-sm leading-6">
                {audiencePresentation.onsiteNextStep.explanation}
              </p>
            </section>
          )}

          {(criticalRisks.length > 0 ||
            report.missingInformation.length > 0) && (
            <section
              aria-labelledby="saved-checks-heading"
              className="bg-pool-50 rounded-xl p-5 sm:p-6"
            >
              <h3
                id="saved-checks-heading"
                className="text-pool-950 text-lg font-semibold"
              >
                Saved checks to complete
              </h3>
              <ul className="text-pool-700 mt-4 space-y-3 text-sm leading-6">
                {criticalRisks.map((risk) => (
                  <li key={risk.id} className="flex gap-2">
                    <span aria-hidden="true" className="text-pool-400">
                      •
                    </span>
                    <span>{risk.action}</span>
                  </li>
                ))}
                {report.missingInformation.map((item) => (
                  <li key={item.id} className="flex gap-2">
                    <span aria-hidden="true" className="text-pool-400">
                      •
                    </span>
                    <span>
                      Confirm {lowercaseFirst(item.label)} before final design
                      or construction.
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

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
                    <h4 className="text-pool-950 font-semibold">
                      {step.title}
                    </h4>
                    <p className="text-pool-700 mt-1 text-sm leading-6">
                      {step.summary}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
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
              This report does not constitute surveying, engineering,
              geotechnical advice, utility locating, building consent, resource
              consent or approval to undertake construction. Relevant conditions
              and infrastructure should be independently verified before final
              design, excavation or construction.
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
      )}
    </article>
  );
}

function ReportSafetySummary({
  report,
  assessmentIds,
  constructabilitySections,
  criticalRisks,
  showTechnicalConstructability,
}: {
  report: SavedPreliminaryReport;
  assessmentIds: readonly ReportAssessment["id"][];
  constructabilitySections: ReportConstructabilitySection[];
  criticalRisks: SavedPreliminaryReport["risks"];
  showTechnicalConstructability: boolean;
}) {
  const assessmentItems = assessmentIds
    .map((id) => report.assessments[id])
    .filter((assessment) => assessment.status !== "green");
  const findings = report.keyFindings.filter(
    (finding) => finding.severity !== "green",
  );
  const constructabilityItems = constructabilitySections.filter(
    (section) => section.status !== "no_obvious_concern",
  );
  const homeownerConstructabilityItems = showTechnicalConstructability
    ? []
    : [
        ...(constructabilityItems.some(
          (section) => section.status === "needs_checking",
        )
          ? [
              {
                statusLabel: "Needs checking",
                title: "Site checks need confirmation",
                summary:
                  "Saved Site answers or mapped conditions identified potential site considerations. Ask your pool builder to confirm them onsite.",
              },
            ]
          : []),
        ...(constructabilityItems.some(
          (section) => section.status === "not_fully_assessed",
        )
          ? [
              {
                statusLabel: "Not fully assessed",
                title: "Site checks were not fully assessed",
                summary:
                  "Some saved Site answers or mapped evidence were unavailable or uncertain. Ask your pool builder to confirm them onsite.",
              },
            ]
          : []),
      ];

  return (
    <section aria-labelledby="safety-summary-heading">
      <h3
        id="safety-summary-heading"
        className="text-pool-950 text-xl font-semibold tracking-[-0.02em]"
      >
        Safety summary
      </h3>
      <p className="text-pool-600 mt-2 max-w-3xl text-sm leading-6">
        Read these warnings, uncertain results and saved limitations before
        acting. Supporting evidence remains in Property findings.
      </p>
      <div className="mt-5 space-y-4">
        {report.warnings.map((warning) => (
          <article
            key={`${warning.code}-${warning.title}`}
            className="border-pool-200 rounded-[3px] border p-4"
          >
            <p className="text-pool-950 font-semibold">{warning.title}</p>
            <p className="text-pool-700 mt-1 text-sm leading-6">
              {warning.message}
            </p>
          </article>
        ))}
        {findings.map((finding) => (
          <article
            key={finding.id}
            className="border-pool-200 rounded-[3px] border p-4"
          >
            <p
              className={`text-sm font-bold ${statusTextClasses(finding.severity)}`}
            >
              {reportShortStatus(finding.severity)}
            </p>
            <p className="text-pool-950 mt-1 font-semibold">{finding.title}</p>
            <p className="text-pool-700 mt-1 text-sm leading-6">
              {finding.clientSummary}
            </p>
          </article>
        ))}
        {criticalRisks.map((risk) => (
          <article
            key={risk.id}
            className="border-pool-200 rounded-[3px] border p-4"
          >
            <p className="text-sm font-bold text-amber-800">Needs checking</p>
            <p className="text-pool-950 mt-1 font-semibold">{risk.title}</p>
            <p className="text-pool-700 mt-1 text-sm leading-6">
              {risk.evidence}
            </p>
          </article>
        ))}
        {assessmentItems.map((assessment) => (
          <article
            key={assessment.id}
            className="border-pool-200 rounded-[3px] border p-4"
          >
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <p className="text-pool-950 font-semibold">{assessment.title}</p>
              <p
                className={`text-sm font-bold ${statusTextClasses(assessment.status)}`}
              >
                {reportShortStatus(assessment.status)}
              </p>
            </div>
            <p className="text-pool-700 mt-1 text-sm leading-6">
              {assessment.summary}
            </p>
          </article>
        ))}
        {homeownerConstructabilityItems.map((item) => (
          <article
            key={item.statusLabel}
            className="border-pool-200 rounded-[3px] border p-4"
          >
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <p className="text-pool-950 font-semibold">{item.title}</p>
              <p className="text-pool-800 text-sm font-bold">
                {item.statusLabel}
              </p>
            </div>
            <p className="text-pool-700 mt-1 text-sm leading-6">
              {item.summary}
            </p>
          </article>
        ))}
        {showTechnicalConstructability &&
          constructabilityItems.map((section) => (
            <article
              key={section.id}
              className="border-pool-200 rounded-[3px] border p-4"
            >
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <p className="text-pool-950 font-semibold">{section.title}</p>
                <p className="text-pool-800 text-sm font-bold">
                  {section.statusLabel}
                </p>
              </div>
              <p className="text-pool-700 mt-1 text-sm leading-6">
                {section.summary}
              </p>
            </article>
          ))}
        {report.missingInformation.length > 0 && (
          <div className="border-pool-200 bg-pool-50 rounded-[3px] border p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <p className="text-pool-950 font-semibold">
                Missing information to confirm
              </p>
              <p className="text-pool-800 text-sm font-bold">Not assessed</p>
            </div>
            <ul className="text-pool-700 mt-2 space-y-2 text-sm leading-6">
              {report.missingInformation.map((item) => (
                <li key={item.id} className="flex gap-2">
                  <span aria-hidden="true">•</span>
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {report.limitations.length > 0 && (
          <div className="border-pool-200 bg-pool-50 rounded-[3px] border p-4">
            <p className="text-pool-950 font-semibold">
              Saved report limitations
            </p>
            <ul className="text-pool-700 mt-2 space-y-2 text-sm leading-6">
              {report.limitations.map((limitation) => (
                <li key={limitation} className="flex gap-2">
                  <span aria-hidden="true">•</span>
                  <span>{limitation}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function ConstructabilitySection({
  section,
}: {
  section: ReportConstructabilitySection;
}) {
  return (
    <article className="border-pool-200 rounded-xl border p-5 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <h4 className="text-pool-950 font-semibold">{section.title}</h4>
        <p className="text-pool-800 text-sm font-bold">{section.statusLabel}</p>
      </div>
      <p className="text-pool-700 mt-2 text-sm leading-6">{section.summary}</p>
      {section.details.length > 0 && (
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {section.details.map((detail) => (
            <div
              key={`${detail.label}-${detail.value}`}
              className="border-pool-200 border-t pt-2"
            >
              <dt className="text-pool-600">{detail.label}</dt>
              <dd className="text-pool-900 mt-1 font-semibold">
                {detail.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {section.evidence.length > 0 && (
        <ul className="mt-4 space-y-2 text-sm">
          {section.evidence.map((item, index) => (
            <li
              key={`${item.provenance}-${item.description}-${index}`}
              className="text-pool-700"
            >
              <strong className="text-pool-900">{item.provenance}:</strong>{" "}
              {item.description}
            </li>
          ))}
        </ul>
      )}
      {section.provenanceNote && (
        <p className="border-pool-200 bg-pool-50 text-pool-800 mt-4 rounded-lg border p-3 text-sm leading-6">
          {section.provenanceNote}
        </p>
      )}
      {section.excavation && (
        <div className="border-pool-200 mt-5 border-t pt-4">
          <h5 className="text-pool-950 font-semibold">
            {section.excavation.heading}
          </h5>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {section.excavation.scenarios.map((scenario) => (
              <div key={scenario.id} className="bg-pool-50 rounded-lg p-3">
                <dt className="text-pool-600 text-sm">{scenario.label}</dt>
                <dd className="text-pool-950 mt-1 text-lg font-bold">
                  {scenario.formattedValue}
                </dd>
              </div>
            ))}
          </dl>
          <div className="text-pool-700 mt-3 space-y-2 text-sm leading-6">
            <p>{section.excavation.publicDisclosure}</p>
            <p>{section.excavation.terrainLabel}</p>
            {section.excavation.specialistDepthWarning && (
              <p className="font-semibold">
                {section.excavation.specialistDepthWarning}
              </p>
            )}
          </div>
        </div>
      )}
      <p className="text-pool-600 mt-4 text-xs leading-5">{section.boundary}</p>
    </article>
  );
}

function AssessmentReadingGuide() {
  return (
    <section
      aria-labelledby="how-to-read-heading"
      className="border-pool-200 overflow-hidden border-b bg-white"
    >
      <details className="group">
        <summary className="text-pool-950 focus-visible:outline-pool-blue-700 hover:bg-pool-50 flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 px-5 py-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] sm:px-8 lg:px-10 [&::-webkit-details-marker]:hidden">
          <div>
            <h3 id="how-to-read-heading" className="text-lg font-semibold">
              {PRELIMINARY_FEASIBILITY_READING_GUIDE.title}
            </h3>
            <span className="text-pool-700 mt-1 block text-sm">
              A quick guide to the map checks and your next step.
            </span>
          </div>
          <span className="bg-pool-blue-50 text-pool-blue-800 group-open:bg-pool-blue-100 inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold">
            <span className="group-open:hidden">Open guide</span>
            <span className="hidden group-open:inline">Close guide</span>
            <span
              aria-hidden="true"
              className="text-base leading-none group-open:hidden"
            >
              +
            </span>
            <span
              aria-hidden="true"
              className="hidden text-base leading-none group-open:inline"
            >
              −
            </span>
          </span>
        </summary>
        <div className="border-pool-200 bg-pool-50 border-t px-5 py-5 sm:px-8 lg:px-10">
          <p className="text-pool-700 max-w-4xl text-sm leading-6">
            {PRELIMINARY_FEASIBILITY_READING_GUIDE.summary}
          </p>
          <ol className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-3">
            {PRELIMINARY_FEASIBILITY_READING_GUIDE.workflow.map(
              (step, index) => (
                <li key={step.title} className="min-w-0">
                  <div className="flex items-start gap-2">
                    <span
                      aria-hidden="true"
                      className="bg-pool-blue-100 text-pool-blue-800 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold"
                    >
                      {index + 1}
                    </span>
                    <div>
                      <h4 className="text-pool-950 text-sm font-bold">
                        {step.title}
                      </h4>
                      <p className="text-pool-700 mt-1 text-sm leading-6">
                        {step.summary}
                      </p>
                    </div>
                  </div>
                </li>
              ),
            )}
          </ol>
          <h4 className="text-pool-950 mt-5 text-sm font-semibold">
            {PRELIMINARY_FEASIBILITY_READING_GUIDE.statusTitle}
          </h4>
          <ul className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {PRELIMINARY_FEASIBILITY_READING_GUIDE.statuses.map((status) => (
              <li key={status.status} className="min-w-0">
                <h4
                  className={`text-sm font-bold ${statusTextClasses(status.status)}`}
                >
                  {status.title}
                </h4>
                <p className="text-pool-700 mt-1 text-sm leading-6">
                  {status.summary}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </section>
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

function formatSourceDate(value: string) {
  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Pacific/Auckland",
  }).format(new Date(value));
}

function lowercaseFirst(value: string) {
  return value.length > 0
    ? `${value[0]!.toLocaleLowerCase()}${value.slice(1)}`
    : value;
}
