"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  Download,
  FileText,
  Printer,
} from "lucide-react";
import Image from "next/image";
import { AssessmentExplanationResult } from "@/components/assessment-explanation-result";
import { FeasibilityAssessmentResult } from "@/components/feasibility-assessment-result";
import {
  SavedAssessmentReportPanel,
  useSavedAssessmentReport,
} from "@/components/saved-assessment-report-panel";
import {
  PropertyAerialMap,
  type PropertyPoolPlacement,
} from "@/components/map/property-aerial-map";
import { SessionAssessmentResult } from "@/components/session-assessment-result";
import {
  buildSessionAssessment,
  type SessionAssessment,
} from "@/modules/assessment/build-session-assessment";
import type { DataAccessSpikeResult } from "@/modules/data-access-spike/run-data-access-spike";
import type { AssessmentExplanation } from "@/modules/recommendations/generate-assessment-explanation";
import { humanizeIdentifierTitleCase as humanize } from "@/shared/text/humanize-identifier";

export type AssessmentWorkspaceResult = DataAccessSpikeResult & {
  assessmentExplanation?: AssessmentExplanation;
  reportToken: string;
};

const sectionIds = [
  "property",
  "scoring",
  "risks",
  "sources",
  "limits",
] as const;
type SectionId = (typeof sectionIds)[number];
export function AssessmentWorkspace({
  result,
  onDownloadData,
  onRetry,
}: {
  result: AssessmentWorkspaceResult;
  onDownloadData: () => void;
  onRetry: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [openSections, setOpenSections] = useState<Set<SectionId>>(
    new Set(["property"]),
  );
  const [mapImage, setMapImage] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [page, setPage] = useState(1);
  const [placement, setPlacement] = useState<PropertyPoolPlacement | null>(
    null,
  );
  const savedReport = useSavedAssessmentReport();
  const savedReference = savedReport.assessment?.reference ?? null;
  const assessment = buildSessionAssessment(
    result,
    result.assessmentExplanation,
  );
  const datasets = Object.entries(result.datasets);
  const successful = datasets.filter(
    ([, item]) => item.status === "success",
  ).length;
  const unavailable = datasets.filter(
    ([, item]) => item.status === "unavailable",
  ).length;
  const parcelStatus = parcelStatusPresentation(result);
  const onSnapshotReady = useCallback(
    (dataUrl: string | null) => setMapImage(dataUrl),
    [],
  );
  const onPlacementChange = useCallback(
    (nextPlacement: PropertyPoolPlacement | null) =>
      setPlacement(nextPlacement),
    [],
  );

  useEffect(() => {
    headingRef.current?.focus();
  }, [result.resolvedAddress.addressId]);

  function toggle(id: SectionId, open: boolean) {
    setOpenSections((current) => {
      const next = new Set(current);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  if (savedReport.showReport && savedReport.assessment) {
    return (
      <SavedAssessmentReportPanel
        assessment={savedReport.assessment}
        showReport
        onOpen={savedReport.openReport}
        onBack={savedReport.closeReport}
      />
    );
  }

  if (preview) {
    return (
      <ReportPreview
        assessment={assessment}
        savedReference={savedReference}
        mapImage={mapImage}
        page={page}
        onPage={setPage}
        onBack={() => setPreview(false)}
        onPrint={() => window.print()}
      />
    );
  }

  return (
    <section aria-labelledby="assessment-heading" className="space-y-6">
      <div className="border-pool-200 border-b pb-5">
        <h2
          ref={headingRef}
          id="assessment-heading"
          tabIndex={-1}
          className="text-pool-950 text-2xl font-semibold tracking-tight sm:text-4xl"
        >
          {result.resolvedAddress.fullAddress}
        </h2>
        <p className="text-pool-600 mt-2 font-mono text-sm">
          Retrieved {formatDate(result.generatedAt)} · LINZ address ID{" "}
          {result.resolvedAddress.addressId}
        </p>
      </div>

      <div role="status" className={parcelStatus.className}>
        <p className="text-pool-950 text-sm font-semibold">
          {parcelStatus.heading}
        </p>
        <p className="text-pool-700 mt-1 text-sm">{parcelStatus.detail}</p>
      </div>

      <div className="border-pool-200 overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_0_rgb(0_0_0/5%)]">
        <div className="bg-pool-blue-50/70 grid gap-5 p-5 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-7">
          <div className="bg-pool-950 grid size-20 place-items-center rounded-full text-2xl font-semibold text-white sm:size-24 sm:text-3xl">
            {result.feasibilityAssessment.score ?? "—"}
          </div>
          <div>
            <p className="text-pool-blue-800 text-xs font-semibold tracking-[0.12em] uppercase">
              Screening recommendation
            </p>
            <h3 className="text-pool-950 mt-1 text-xl leading-snug font-semibold sm:text-2xl">
              {result.feasibilityAssessment.finalRecommendation}
            </h3>
            <p className="text-pool-700 mt-2 text-sm leading-6">
              {result.feasibilityAssessment.band
                ? humanize(result.feasibilityAssessment.band)
                : "Indeterminate"}{" "}
              · {humanize(result.feasibilityAssessment.confidence.level)}{" "}
              confidence
            </p>
          </div>
          <div className="border-pool-blue-200 text-pool-700 rounded-xl border bg-white/80 p-4 text-sm sm:max-w-56">
            <p className="text-pool-950 font-semibold">What happens next</p>
            <p className="mt-1 leading-5">
              Review the proposed layout, then ask a builder to verify the site
              before design or construction decisions.
            </p>
          </div>
        </div>
        {result.feasibilityAssessment.criticalFlags.length > 0 && (
          <div className="border-pool-blue-100 border-t px-5 py-4 sm:px-7">
            <p className="text-pool-900 text-sm font-semibold">
              Critical flags
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {result.feasibilityAssessment.criticalFlags.map((flag) => (
                <span
                  key={flag.id}
                  className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900"
                >
                  {humanize(flag.id)}
                </span>
              ))}
            </div>
          </div>
        )}
        {result.blockers.length > 0 && (
          <div className="border-t border-amber-200 bg-amber-50 px-5 py-4 sm:px-7">
            <p className="flex items-center gap-2 font-semibold text-amber-950">
              <AlertTriangle className="size-4" aria-hidden="true" />
              Assessment blockers
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-amber-900">
              {result.blockers.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="border-pool-200 flex flex-col gap-4 rounded-2xl border bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-pool-950 font-semibold">
            Ready for a preliminary report?
          </p>
          <p className="text-pool-600 text-sm">
            The report includes the selected property, pool concept, mapped
            evidence, warnings, and recommended follow-up.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!mapImage}
            onClick={() =>
              document
                .getElementById("homeowner-details-heading")
                ?.scrollIntoView({ behavior: "smooth" })
            }
            className="bg-pool-950 hover:bg-pool-blue-800 focus-visible:outline-pool-blue-700 disabled:bg-pool-400 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 font-semibold text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed"
          >
            <FileText className="size-4" aria-hidden="true" />
            Get my preliminary report
          </button>
          <button
            type="button"
            disabled={!mapImage}
            onClick={() => setPreview(true)}
            className="border-pool-300 text-pool-800 hover:border-pool-blue-600 hover:text-pool-blue-800 focus-visible:outline-pool-blue-700 disabled:bg-pool-100 disabled:text-pool-400 inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed"
          >
            Generate PDF report
          </button>
          <button
            type="button"
            onClick={onDownloadData}
            className="border-pool-300 text-pool-800 hover:border-pool-blue-600 hover:text-pool-blue-800 inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 font-semibold"
          >
            <Download className="size-4" aria-hidden="true" />
            Assessment data
          </button>
        </div>
      </div>

      <section aria-labelledby="map-workspace-heading" className="space-y-4">
        <div>
          <p className="text-pool-blue-800 text-xs font-semibold tracking-[0.12em] uppercase">
            Property workspace
          </p>
          <h3
            id="map-workspace-heading"
            className="text-pool-950 mt-1 text-xl font-semibold"
          >
            Place a pool concept on the selected property
          </h3>
          <p className="text-pool-600 mt-1 max-w-3xl text-sm leading-6">
            The map is the working surface. Choose a size, drag the pool, and
            rotate it to explore the mapped evidence. Warnings are screening
            signals, not building approval.
          </p>
        </div>
        <PropertyAerialMap
          result={result}
          onRetry={onRetry}
          onSnapshotReady={onSnapshotReady}
          onPlacementChange={onPlacementChange}
        />
      </section>

      {savedReport.assessment ? (
        <SavedAssessmentReportPanel
          assessment={savedReport.assessment}
          showReport={false}
          onOpen={savedReport.openReport}
          onBack={savedReport.closeReport}
        />
      ) : placement && mapImage ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-900">
          This legacy assessment view cannot save a report until it has a
          server-issued assessment snapshot. Use the fast property workflow.
        </p>
      ) : (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-900">
          Complete a valid pool placement before saving the report.
        </p>
      )}

      <div className="border-pool-200 flex items-center justify-between gap-3 border-t pt-5">
        <h3 className="text-pool-950 text-lg font-semibold">
          Assessment details
        </h3>
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            onClick={() => setOpenSections(new Set(sectionIds))}
            className="text-pool-blue-800 font-semibold hover:underline"
          >
            Expand all
          </button>
          <span className="text-pool-300" aria-hidden="true">
            /
          </span>
          <button
            type="button"
            onClick={() => setOpenSections(new Set())}
            className="text-pool-700 font-semibold hover:underline"
          >
            Collapse all
          </button>
        </div>
      </div>

      <Disclosure
        id="property"
        title="Property map and official evidence"
        summary={`${successful} datasets retrieved · ${unavailable} unavailable`}
        open={openSections.has("property")}
        onToggle={toggle}
      >
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Info
            title="Property identity"
            items={[
              `Parcel ${result.parcel.parcelId}`,
              result.parcel.appellation || "Appellation not supplied",
              `${result.parcel.calculatedAreaSquareMetres?.toLocaleString("en-NZ") ?? "Unknown"} m²`,
              `Boundary state: ${humanize(result.boundaryState)}`,
              `Regional layer coverage: ${humanize(result.regionCoverageState)}`,
            ]}
          />
          <Info
            title="Identity checks"
            items={[
              result.identityCheck.exactAddressMatched
                ? "Exact supplied address matched"
                : "Exact address not confirmed",
              result.identityCheck.distinctFromAlternatives
                ? "Separated from alternatives"
                : "Shares a parcel with an alternative",
              parcelStatus.heading,
            ]}
          />
        </div>
      </Disclosure>
      <Disclosure
        id="scoring"
        title="Assessment and scoring"
        summary={`${result.feasibilityAssessment.score ?? "Not scored"} points · ${result.feasibilityAssessment.band ? humanize(result.feasibilityAssessment.band) : "Indeterminate"}`}
        open={openSections.has("scoring")}
        onToggle={toggle}
      >
        <div className="space-y-5">
          <FeasibilityAssessmentResult
            assessment={result.feasibilityAssessment}
          />
          {result.assessmentExplanation && (
            <AssessmentExplanationResult
              explanation={result.assessmentExplanation}
            />
          )}
        </div>
      </Disclosure>
      <Disclosure
        id="risks"
        title="Risks and actions"
        summary={`${assessment.risks.length} risks · ${assessment.actions.flatMap((group) => group.items).length} actions`}
        open={openSections.has("risks")}
        onToggle={toggle}
      >
        <SessionAssessmentResult assessment={assessment} />
      </Disclosure>
      <Disclosure
        id="sources"
        title="Sources and provenance"
        summary={`${datasets.length} official dataset records`}
        open={openSections.has("sources")}
        onToggle={toggle}
      >
        <div className="border-pool-200 overflow-x-auto rounded-2xl border bg-white">
          <table className="w-full min-w-160 text-left text-sm">
            <thead className="bg-pool-50 text-pool-600">
              <tr>
                <th className="p-3">Dataset</th>
                <th className="p-3">Provider</th>
                <th className="p-3">Status</th>
                <th className="p-3">Evidence use</th>
              </tr>
            </thead>
            <tbody>
              {datasets.map(([key, item]) => (
                <tr key={key} className="border-pool-100 border-t">
                  <td className="text-pool-900 p-3 font-medium">
                    {item.dataset}
                  </td>
                  <td className="text-pool-700 p-3">{item.provider}</td>
                  <td className="text-pool-700 p-3">{humanize(item.status)}</td>
                  <td className="text-pool-700 p-3">
                    {humanize(item.evidenceUse)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Disclosure>
      <Disclosure
        id="limits"
        title="Limits and unknowns"
        summary={`${assessment.missingInformation.length} items require verification`}
        open={openSections.has("limits")}
        onToggle={toggle}
      >
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="font-semibold text-amber-950">
            Preliminary desktop assessment only
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-900">
            {assessment.limitations.join(" ")}
          </p>
          <ul className="mt-4 grid gap-2 text-sm text-amber-900 sm:grid-cols-2">
            {assessment.missingInformation.map((item) => (
              <li key={item.id} className="flex gap-2">
                <AlertTriangle
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      </Disclosure>
    </section>
  );
}

function parcelStatusPresentation(result: DataAccessSpikeResult): {
  className: string;
  heading: string;
  detail: string;
} {
  if (
    result.parcelMatch.status === "mapped_primary_parcel" &&
    result.identityCheck.distinctFromAlternatives
  ) {
    return {
      className:
        "rounded-2xl border border-pool-blue-200 bg-pool-blue-50 px-4 py-3",
      heading: "Legal parcel confirmed",
      detail: `Parcel ${result.parcel.parcelId} is the confirmed parcel for this selected address.`,
    };
  }

  return {
    className: "rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3",
    heading: "Legal parcel requires manual review",
    detail:
      "The address remains viewable, but do not treat its parcel as confirmed.",
  };
}

function Disclosure({
  id,
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  id: SectionId;
  title: string;
  summary: string;
  open: boolean;
  onToggle: (id: SectionId, open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <details
      open={open}
      onToggle={(event) => onToggle(id, event.currentTarget.open)}
      className="group border-pool-200 overflow-hidden rounded-2xl border bg-white shadow-sm"
    >
      <summary className="focus-visible:outline-pool-blue-700 flex min-h-18 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 focus-visible:outline-2 focus-visible:outline-offset-[-2px]">
        <span>
          <span className="text-pool-950 block font-semibold">{title}</span>
          <span className="text-pool-600 mt-1 block text-sm">{summary}</span>
        </span>
        <ChevronDown
          className="text-pool-500 size-5 shrink-0 transition group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="border-pool-200 bg-pool-50/60 border-t p-4 sm:p-5">
        {children}
      </div>
    </details>
  );
}

function Info({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="border-pool-200 rounded-2xl border bg-white p-5">
      <h4 className="text-pool-950 font-semibold">{title}</h4>
      <ul className="text-pool-700 mt-3 space-y-2 text-sm">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function ReportPreview({
  assessment,
  savedReference,
  mapImage,
  page,
  onPage,
  onBack,
  onPrint,
}: {
  assessment: SessionAssessment;
  savedReference: string | null;
  mapImage: string | null;
  page: number;
  onPage: (page: number) => void;
  onBack: () => void;
  onPrint: () => void;
}) {
  return (
    <section aria-labelledby="report-preview-heading" className="space-y-4">
      <div className="border-pool-200 flex flex-col gap-3 rounded-2xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="text-pool-800 inline-flex min-h-11 items-center gap-2 font-semibold"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to assessment
        </button>
        <div className="sm:text-center">
          <h2
            id="report-preview-heading"
            className="text-pool-950 font-semibold"
          >
            PDF report preview
          </h2>
          <p className="text-pool-600 text-sm">Page {page} of 3 · A4</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={!mapImage}
            onClick={onPrint}
            className="border-pool-300 text-pool-800 disabled:bg-pool-100 disabled:text-pool-400 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border bg-white px-4 font-semibold disabled:cursor-not-allowed"
          >
            <Printer className="size-4" aria-hidden="true" />
            Print / save PDF
          </button>
        </div>
      </div>
      {!mapImage && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Open the property map once before printing so the report can capture
          the official map evidence.
        </p>
      )}
      <div className="bg-pool-200 overflow-auto rounded-3xl p-3 sm:p-8">
        <div className="mx-auto aspect-[210/297] w-full max-w-190 overflow-hidden bg-white p-[5%] shadow-xl">
          <PreviewPage
            assessment={assessment}
            mapImage={mapImage}
            page={page}
            savedReference={savedReference}
          />
        </div>
      </div>
      <nav aria-label="Report pages" className="flex justify-center gap-2">
        {[1, 2, 3].map((number) => (
          <button
            key={number}
            type="button"
            aria-current={page === number ? "page" : undefined}
            onClick={() => onPage(number)}
            className={`size-11 rounded-xl border font-semibold ${page === number ? "border-pool-blue-700 bg-pool-blue-700 text-white" : "border-pool-300 text-pool-700 bg-white"}`}
          >
            {number}
          </button>
        ))}
      </nav>
      <div
        id="browser-print-report"
        className="browser-print-report"
        aria-hidden="true"
      >
        {[1, 2, 3].map((number) => (
          <div className="browser-print-page" key={number}>
            <PreviewPage
              assessment={assessment}
              mapImage={mapImage}
              page={number}
              savedReference={savedReference}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function PreviewPage({
  assessment,
  mapImage,
  page,
  savedReference,
}: {
  assessment: SessionAssessment;
  mapImage: string | null;
  page: number;
  savedReference?: string | null;
}) {
  const map = mapImage ? (
    <Image
      src={mapImage}
      alt="Captured property assessment map"
      width={1200}
      height={700}
      unoptimized
      className="mt-4 h-auto max-h-[42%] w-full rounded-lg object-contain"
    />
  ) : (
    <div className="bg-pool-200 text-pool-600 mt-4 grid h-[42%] place-items-center rounded-lg text-sm">
      Map capture pending
    </div>
  );
  return (
    <article className="text-pool-700 flex h-full flex-col text-[clamp(0.5rem,1.2vw,0.85rem)]">
      <header className="border-pool-300 flex justify-between border-b pb-3">
        <div>
          <b className="text-pool-950">Pool feasibility assessment</b>
          <span className="block">
            {page === 1
              ? "Executive summary"
              : page === 2
                ? "Property constraints"
                : "Risks and actions"}
          </span>
        </div>
        <span className="font-mono">Page {page} of 3</span>
      </header>
      {page === 1 && (
        <>
          <h3 className="text-pool-950 mt-6 text-[2em] leading-tight font-semibold">
            {assessment.property.address}
          </h3>
          <p>{assessment.property.appellation}</p>
          <div className="border-pool-blue-200 bg-pool-blue-50 mt-5 grid grid-cols-[auto_1fr] gap-4 rounded-xl border p-4">
            <span className="bg-pool-blue-800 grid size-16 place-items-center rounded-full text-xl font-bold text-white">
              {assessment.feasibilityAssessment.score ?? "—"}
            </span>
            <div>
              <b className="text-pool-950 text-[1.2em]">
                {assessment.recommendation}
              </b>
              <p className="text-pool-blue-900 mt-1 font-semibold">
                Recommended screened size:{" "}
                {assessment.scenarioComparison.recommendedShell
                  ? `${assessment.scenarioComparison.recommendedShell.label} · ${assessment.scenarioComparison.recommendedShell.lengthMetres}m × ${assessment.scenarioComparison.recommendedShell.widthMetres}m`
                  : "No supported size recommendation"}
              </p>
              <p className="mt-1">
                {assessment.feasibilityAssessment.band
                  ? humanize(assessment.feasibilityAssessment.band)
                  : "Indeterminate"}{" "}
                · {humanize(assessment.feasibilityAssessment.confidence.level)}{" "}
                confidence
              </p>
            </div>
          </div>
          <h4 className="text-pool-950 mt-5 font-semibold">Priority risks</h4>
          <ul className="mt-2 space-y-2">
            {assessment.risks.slice(0, 3).map((risk) => (
              <li key={risk.id} className="border-l-2 border-amber-600 pl-3">
                <b>{risk.title}</b>
                <span className="block">{risk.impact}</span>
              </li>
            ))}
          </ul>
          {map}
        </>
      )}
      {page === 2 && (
        <>
          <h3 className="text-pool-950 mt-6 text-[2em] font-semibold">
            Mapped property evidence
          </h3>
          <p>Official geometry returned during this session.</p>
          {map}
          <div className="mt-4 grid grid-cols-2 gap-2">
            {assessment.provenance.datasets.slice(0, 6).map((item) => (
              <div key={item.id} className="border-pool-200 rounded border p-2">
                <b>{item.dataset}</b>
                <span className="block">
                  {humanize(item.status)} · {humanize(item.confidence)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      {page === 3 && (
        <>
          <h3 className="text-pool-950 mt-6 text-[2em] font-semibold">
            What needs attention next
          </h3>
          <div className="mt-5 grid grid-cols-2 gap-5">
            <div>
              <h4 className="text-pool-950 font-semibold">Material risks</h4>
              <ul className="mt-2 space-y-2">
                {assessment.risks.slice(0, 5).map((risk) => (
                  <li
                    key={risk.id}
                    className="border-l-2 border-orange-600 pl-2"
                  >
                    <b>{risk.title}</b>
                    <span className="block">{risk.action}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-pool-950 font-semibold">
                Prioritised actions
              </h4>
              <ul className="mt-2 list-disc space-y-2 pl-4">
                {assessment.actions
                  .flatMap((group) => group.items)
                  .slice(0, 7)
                  .map((item) => (
                    <li key={item}>{item}</li>
                  ))}
              </ul>
              <h4 className="text-pool-950 mt-4 font-semibold">
                Missing information
              </h4>
              <ul className="mt-2 list-disc pl-4">
                {assessment.missingInformation.slice(0, 7).map((item) => (
                  <li key={item.id}>{item.label}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="border-pool-300 mt-5 border-t pt-3">
            <b>Limit:</b> {assessment.limitations.join(" ")}
          </p>
        </>
      )}
      <footer className="border-pool-300 text-pool-500 mt-auto border-t pt-2">
        {savedReference
          ? `Saved assessment ${savedReference}`
          : "Internal preliminary assessment · No durable report history"}
      </footer>
    </article>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NZ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
