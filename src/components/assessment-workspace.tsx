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
  LoaderCircle,
  Printer,
} from "lucide-react";
import Image from "next/image";
import { AssessmentExplanationResult } from "@/components/assessment-explanation-result";
import { FeasibilityAssessmentResult } from "@/components/feasibility-assessment-result";
import { PropertyAerialMap } from "@/components/map/property-aerial-map";
import { PoolScenarioComparisonResult } from "@/components/pool-scenario-comparison-result";
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
  "scenarios",
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
  const [generating, setGenerating] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
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
  const onSnapshotReady = useCallback(
    (dataUrl: string | null) => setMapImage(dataUrl),
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

  async function downloadPdf() {
    if (!mapImage || generating) return;
    setGenerating(true);
    setPdfError(null);
    try {
      const response = await fetch("/api/internal/report/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportToken: result.reportToken,
          mapImageDataUrl: mapImage,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(
          body?.error?.message ?? "The PDF could not be generated.",
        );
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `pool-feasibility-${result.resolvedAddress.addressId}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The PDF could not be generated. Your assessment remains available.";
      setPdfError(`${message} Use Print / save PDF instead.`);
    } finally {
      setGenerating(false);
    }
  }

  if (preview) {
    return (
      <ReportPreview
        assessment={assessment}
        mapImage={mapImage}
        page={page}
        onPage={setPage}
        onBack={() => setPreview(false)}
        onDownload={() => void downloadPdf()}
        onPrint={() => window.print()}
        generating={generating}
        error={pdfError}
      />
    );
  }

  return (
    <section aria-labelledby="assessment-heading" className="space-y-5">
      <div>
        <h2
          ref={headingRef}
          id="assessment-heading"
          tabIndex={-1}
          className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl"
        >
          {result.resolvedAddress.fullAddress}
        </h2>
        <p className="mt-2 font-mono text-sm text-slate-600">
          Retrieved {formatDate(result.generatedAt)} · LINZ address ID{" "}
          {result.resolvedAddress.addressId}
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-teal-200 bg-white shadow-sm">
        <div className="grid gap-5 bg-teal-50/70 p-5 sm:grid-cols-[auto_1fr] sm:p-7">
          <div className="grid size-24 place-items-center rounded-full bg-teal-800 text-3xl font-semibold text-white">
            {result.feasibilityAssessment.score ?? "—"}
          </div>
          <div>
            <p className="text-sm font-semibold text-teal-800">
              Preliminary recommendation
            </p>
            <h3 className="mt-1 text-xl leading-snug font-semibold text-slate-950 sm:text-2xl">
              {result.feasibilityAssessment.finalRecommendation}
            </h3>
            <p className="mt-2 text-sm text-slate-700">
              {result.feasibilityAssessment.band
                ? humanize(result.feasibilityAssessment.band)
                : "Indeterminate"}{" "}
              · {humanize(result.feasibilityAssessment.confidence.level)}{" "}
              confidence
            </p>
          </div>
        </div>
        {result.feasibilityAssessment.criticalFlags.length > 0 && (
          <div className="border-t border-teal-100 px-5 py-4 sm:px-7">
            <p className="text-sm font-semibold text-slate-900">
              Critical flags
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {result.feasibilityAssessment.criticalFlags.map((flag) => (
                <span
                  key={flag.id}
                  className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900"
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

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-slate-950">
            Three-page assessment report
          </p>
          <p className="text-sm text-slate-600">
            Preview before downloading. Generated only from this browser
            session.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPreview(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 font-semibold text-white hover:bg-teal-800"
          >
            <FileText className="size-4" aria-hidden="true" />
            Preview PDF report
          </button>
          <button
            type="button"
            onClick={onDownloadData}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-4 font-semibold text-slate-800 hover:border-teal-600 hover:text-teal-800"
          >
            <Download className="size-4" aria-hidden="true" />
            Assessment data
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-950">
          Assessment details
        </h3>
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            onClick={() => setOpenSections(new Set(sectionIds))}
            className="font-semibold text-teal-800 hover:underline"
          >
            Expand all
          </button>
          <span className="text-slate-300" aria-hidden="true">
            /
          </span>
          <button
            type="button"
            onClick={() => setOpenSections(new Set())}
            className="font-semibold text-slate-700 hover:underline"
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
        <PropertyAerialMap
          result={result}
          onRetry={onRetry}
          onSnapshotReady={onSnapshotReady}
        />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Info
            title="Property identity"
            items={[
              `Parcel ${result.parcel.parcelId}`,
              result.parcel.appellation || "Appellation not supplied",
              `${result.parcel.calculatedAreaSquareMetres?.toLocaleString("en-NZ") ?? "Unknown"} m²`,
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
              humanize(result.parcelMatch.status),
            ]}
          />
        </div>
      </Disclosure>
      <Disclosure
        id="scenarios"
        title="Pool size options"
        summary={`${result.scenarioComparison.successfulShells.length} sizes with a possible fit`}
        open={openSections.has("scenarios")}
        onToggle={toggle}
      >
        <PoolScenarioComparisonResult comparison={result.scenarioComparison} />
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
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-160 text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-3">Dataset</th>
                <th className="p-3">Provider</th>
                <th className="p-3">Status</th>
                <th className="p-3">Evidence use</th>
              </tr>
            </thead>
            <tbody>
              {datasets.map(([key, item]) => (
                <tr key={key} className="border-t border-slate-100">
                  <td className="p-3 font-medium text-slate-900">
                    {item.dataset}
                  </td>
                  <td className="p-3 text-slate-700">{item.provider}</td>
                  <td className="p-3 text-slate-700">
                    {humanize(item.status)}
                  </td>
                  <td className="p-3 text-slate-700">
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
      className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <summary className="flex min-h-18 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-teal-700">
        <span>
          <span className="block font-semibold text-slate-950">{title}</span>
          <span className="mt-1 block text-sm text-slate-600">{summary}</span>
        </span>
        <ChevronDown
          className="size-5 shrink-0 text-slate-500 transition group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="border-t border-slate-200 bg-slate-50/60 p-4 sm:p-5">
        {children}
      </div>
    </details>
  );
}

function Info({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h4 className="font-semibold text-slate-950">{title}</h4>
      <ul className="mt-3 space-y-2 text-sm text-slate-700">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function ReportPreview({
  assessment,
  mapImage,
  page,
  onPage,
  onBack,
  onDownload,
  onPrint,
  generating,
  error,
}: {
  assessment: SessionAssessment;
  mapImage: string | null;
  page: number;
  onPage: (page: number) => void;
  onBack: () => void;
  onDownload: () => void;
  onPrint: () => void;
  generating: boolean;
  error: string | null;
}) {
  return (
    <section aria-labelledby="report-preview-heading" className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-11 items-center gap-2 font-semibold text-slate-800"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to assessment
        </button>
        <div className="sm:text-center">
          <h2
            id="report-preview-heading"
            className="font-semibold text-slate-950"
          >
            PDF report preview
          </h2>
          <p className="text-sm text-slate-600">Page {page} of 3 · A4</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={!mapImage}
            onClick={onPrint}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 font-semibold text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            <Printer className="size-4" aria-hidden="true" />
            Print / save PDF
          </button>
          <button
            type="button"
            disabled={!mapImage || generating}
            onClick={onDownload}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {generating ? (
              <LoaderCircle
                className="size-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Download className="size-4" aria-hidden="true" />
            )}
            {generating ? "Generating…" : "Download PDF"}
          </button>
        </div>
      </div>
      {!mapImage && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Open the property map once before downloading so the report can
          capture the official map evidence.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      <div className="overflow-auto rounded-3xl bg-slate-200 p-3 sm:p-8">
        <div className="mx-auto aspect-[210/297] w-full max-w-190 overflow-hidden bg-white p-[5%] shadow-xl">
          <PreviewPage
            assessment={assessment}
            mapImage={mapImage}
            page={page}
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
            className={`size-11 rounded-xl border font-semibold ${page === number ? "border-teal-700 bg-teal-700 text-white" : "border-slate-300 bg-white text-slate-700"}`}
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
}: {
  assessment: SessionAssessment;
  mapImage: string | null;
  page: number;
}) {
  const map = mapImage ? (
    <Image
      src={mapImage}
      alt="Captured property assessment map"
      width={1200}
      height={700}
      unoptimized
      className="mt-4 h-[42%] w-full rounded-lg object-cover"
    />
  ) : (
    <div className="mt-4 grid h-[42%] place-items-center rounded-lg bg-slate-200 text-sm text-slate-600">
      Map capture pending
    </div>
  );
  return (
    <article className="flex h-full flex-col text-[clamp(0.5rem,1.2vw,0.85rem)] text-slate-700">
      <header className="flex justify-between border-b border-slate-300 pb-3">
        <div>
          <b className="text-slate-950">Pool feasibility assessment</b>
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
          <h3 className="mt-6 text-[2em] leading-tight font-semibold text-slate-950">
            {assessment.property.address}
          </h3>
          <p>{assessment.property.appellation}</p>
          <div className="mt-5 grid grid-cols-[auto_1fr] gap-4 rounded-xl border border-teal-200 bg-teal-50 p-4">
            <span className="grid size-16 place-items-center rounded-full bg-teal-800 text-xl font-bold text-white">
              {assessment.feasibilityAssessment.score ?? "—"}
            </span>
            <div>
              <b className="text-[1.2em] text-slate-950">
                {assessment.recommendation}
              </b>
              <p className="mt-1 font-semibold text-teal-900">
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
          <h4 className="mt-5 font-semibold text-slate-950">Priority risks</h4>
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
          <h3 className="mt-6 text-[2em] font-semibold text-slate-950">
            Mapped property evidence
          </h3>
          <p>Official geometry returned during this session.</p>
          {map}
          <div className="mt-4 grid grid-cols-2 gap-2">
            {assessment.provenance.datasets.slice(0, 6).map((item) => (
              <div
                key={item.id}
                className="rounded border border-slate-200 p-2"
              >
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
          <h3 className="mt-6 text-[2em] font-semibold text-slate-950">
            What needs attention next
          </h3>
          <div className="mt-5 grid grid-cols-2 gap-5">
            <div>
              <h4 className="font-semibold text-slate-950">Material risks</h4>
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
              <h4 className="font-semibold text-slate-950">
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
              <h4 className="mt-4 font-semibold text-slate-950">
                Missing information
              </h4>
              <ul className="mt-2 list-disc pl-4">
                {assessment.missingInformation.slice(0, 7).map((item) => (
                  <li key={item.id}>{item.label}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-5 border-t border-slate-300 pt-3">
            <b>Limit:</b> {assessment.limitations.join(" ")}
          </p>
        </>
      )}
      <footer className="mt-auto border-t border-slate-300 pt-2 text-slate-500">
        Internal preliminary assessment · No durable report history
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
