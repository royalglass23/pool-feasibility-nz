"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import type { SessionAssessment } from "@/modules/assessment/build-session-assessment";
import type { PropertyPoolPlacement } from "@/components/map/property-aerial-map";
import type { DataAccessSpikeResult } from "@/modules/data-access-spike/run-data-access-spike";
import type { FastPoolPlacementSnapshot } from "@/modules/data-access-spike/fast-pool-warning";
import type { FastPropertyViewResult } from "@/modules/data-access-spike/fast-property-view";
import type { PersistedAssessmentSubmission } from "@/modules/assessment/persisted-assessment";
import type { SavedPreliminaryReport } from "@/modules/reporting/preliminary-report";
import type { ReportDeliveryState } from "@/components/saved-preliminary-report-view";
import { buildReportAssessmentSnapshot } from "@/modules/reporting/report-assessment-snapshot";
import { visitorTypeOptions } from "@/modules/assessment/visitor-type";
import { trackAnonymousFunnelEvent } from "@/modules/anonymous-funnel-analytics";
import { ActionProgressDialog } from "@/components/action-progress-dialog";

export type AssessmentSubmissionContext = Omit<
  PersistedAssessmentSubmission,
  "idempotencyKey" | "homeowner" | "report"
> & {
  report: Omit<PersistedAssessmentSubmission["report"], "mapImageDataUrl">;
};

export type SavedAssessmentResponse = {
  id: string;
  reference: string;
  status: string;
  created: boolean;
  report: SavedPreliminaryReport;
  reportAccessToken: string;
  delivery: {
    homeowner: ReportDeliveryState;
    internal_test_report: ReportDeliveryState;
  };
};

export function HomeownerSubmissionForm({
  assessmentSnapshot,
  mapImageDataUrl,
  mapVisibleLayerKeys = [],
  placement,
  onSaved,
}: {
  assessmentSnapshot: string;
  mapImageDataUrl: string;
  mapVisibleLayerKeys?: string[];
  placement: FastPoolPlacementSnapshot;
  onSaved: (assessment: SavedAssessmentResponse) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visitorType, setVisitorType] = useState("homeowner");
  const [desiredTiming, setDesiredTiming] = useState("asap");

  useEffect(() => {
    trackAnonymousFunnelEvent({ name: "report_form_viewed" });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (!placement.constructionEnvelopeWithinMappedArea) {
      setError(
        "Move or resize the pool so the full construction envelope stays inside the mapped property before saving.",
      );
      return;
    }
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/public/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentSnapshot,
          mapImageDataUrl,
          mapVisibleLayerKeys,
          poolLayout: {
            lengthMetres: placement.dimensions?.lengthMetres,
            widthMetres: placement.dimensions?.widthMetres,
            rotationDegrees: placement.rotationDegrees,
            position: placement.position,
            clearancesVisible: placement.clearancesVisible ?? true,
          },
          homeowner: {
            name: form.get("name"),
            phone: form.get("phone"),
            email: form.get("email"),
            visitorType: form.get("visitorType"),
            visitorTypeOtherDetail:
              form.get("visitorTypeOtherDetail") || undefined,
            desiredTiming: form.get("desiredTiming"),
            desiredTimingOtherDetail:
              form.get("desiredTimingOtherDetail") || undefined,
            additionalInfo: form.get("additionalInfo") || undefined,
            consentGiven: form.get("consent") === "on",
          },
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        assessment?: SavedAssessmentResponse;
        error?: { message?: string };
      } | null;
      if (!response.ok || !body?.assessment?.report) {
        throw new Error(
          body?.error?.message ?? "The assessment could not be saved.",
        );
      }
      trackAnonymousFunnelEvent({ name: "report_request_submitted" });
      onSaved(body.assessment);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "The assessment could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="border-pool-blue-200 bg-pool-blue-50/60 rounded-2xl border p-5 sm:p-7"
      aria-labelledby="homeowner-details-heading"
    >
      <ActionProgressDialog
        open={saving}
        title="Saving your assessment"
        description="Saving your details and preparing your preliminary report."
      />
      <h3
        id="homeowner-details-heading"
        tabIndex={-1}
        className="text-pool-950 text-xl font-semibold"
      >
        Your details for the preliminary report
      </h3>
      <p className="text-pool-700 mt-2 text-sm leading-6">
        Your saved layout will match the pool position shown above. This is a
        preliminary assessment, not approval or construction advice.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Name" name="name" required />
        <Field label="Phone" name="phone" type="tel" required />
        <Field label="Email" name="email" type="email" required />
        <label className="text-pool-800 text-sm font-medium">
          I am a
          <select
            name="visitorType"
            required
            value={visitorType}
            onChange={(event) => setVisitorType(event.target.value)}
            className="border-pool-300 mt-1 block min-h-11 w-full rounded-lg border bg-white px-3"
          >
            {visitorTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-pool-800 text-sm font-medium">
          When do you need it?
          <select
            name="desiredTiming"
            required
            value={desiredTiming}
            onChange={(event) => setDesiredTiming(event.target.value)}
            className="border-pool-300 mt-1 block min-h-11 w-full rounded-lg border bg-white px-3"
          >
            <option value="asap">ASAP</option>
            <option value="3_months">Within 3 months</option>
            <option value="6_months">Within 6 months</option>
            <option value="12_months">Within 12 months</option>
            <option value="other">Other</option>
          </select>
        </label>
        {visitorType === "other" && (
          <Field
            label="Tell us who you are"
            name="visitorTypeOtherDetail"
            required
          />
        )}
        {desiredTiming === "other" && (
          <Field
            label="Tell us when you need it"
            name="desiredTimingOtherDetail"
            required
          />
        )}
        <label className="text-pool-800 text-sm font-medium sm:col-span-2">
          Additional Info (optional)
          <textarea
            name="additionalInfo"
            maxLength={4000}
            rows={3}
            className="border-pool-300 mt-1 block w-full rounded-lg border bg-white px-3 py-2"
          />
        </label>
        <p className="text-pool-700 text-sm leading-6 sm:col-span-2">
          Before submitting, read our{" "}
          <Link
            href="/privacy"
            className="text-pool-blue-800 decoration-pool-blue-300 hover:text-pool-blue-950 focus-visible:outline-pool-blue-700 font-semibold underline underline-offset-4 outline-offset-4 focus-visible:outline-2"
          >
            privacy notice
          </Link>
          . It explains what we collect, the 12-month retention period, and how
          to ask for access, correction, or early deletion.
        </p>
        <label className="text-pool-800 flex gap-3 text-sm leading-6 sm:col-span-2">
          <input
            name="consent"
            type="checkbox"
            required
            className="mt-1 size-4"
          />
          <span>
            I consent to Royal Glass saving these details and this preliminary
            assessment, sending my report, and following up about this request.
            This is not marketing consent.
          </span>
        </label>
      </div>
      {error && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-950"
        >
          <p className="font-semibold">We couldn't save your report yet</p>
          <p>{error}</p>
          <p className="mt-1 text-red-800">
            <span className="font-semibold">What to try: </span>
            Check the required fields and consent box, then try again. If they
            are already complete, wait a minute and retry.
          </p>
        </div>
      )}
      <button
        type="submit"
        disabled={saving}
        className="bg-pool-950 disabled:bg-pool-400 mt-5 min-h-11 rounded-xl px-5 font-semibold text-white disabled:cursor-not-allowed"
      >
        {saving ? "Saving assessment…" : "Save and show my report"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="text-pool-800 text-sm font-medium">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        className="border-pool-300 mt-1 block min-h-11 w-full rounded-lg border bg-white px-3"
      />
    </label>
  );
}

export function buildDataAccessSubmissionContext(
  result: DataAccessSpikeResult,
  assessment: SessionAssessment,
  placement: PropertyPoolPlacement,
): AssessmentSubmissionContext {
  return {
    addressEvidence: {
      selectedAddressId: result.resolvedAddress.addressId,
      formattedAddress: result.resolvedAddress.fullAddress,
      latitude: result.resolvedAddress.coordinates[1],
      longitude: result.resolvedAddress.coordinates[0],
      boundaryStatus:
        result.boundaryState === "confirmed" ? "confirmed" : "provisional",
      boundaryAreaSquareMetres: result.parcel.calculatedAreaSquareMetres,
      boundaryGeometry: result.parcel.geometry,
      parcelIdentifier: result.parcel.parcelId,
    },
    poolLayout: {
      lengthMetres: placement.lengthMetres,
      widthMetres: placement.widthMetres,
      rotationDegrees: placement.rotationDegrees,
      position: [...placement.position] as [number, number],
      shellGeometry: placement.shellGeometry,
      constructionEnvelopeGeometry: placement.constructionEnvelopeGeometry,
      clearancesVisible: true,
    },
    layerStates: assessment.provenance.datasets.map((dataset) => ({
      provider: dataset.provider,
      dataset: dataset.dataset,
      datasetId: dataset.datasetIdentifier,
      status: layerStatus(dataset.status),
      confidence: confidence(dataset.confidence),
      attribution: dataset.attribution?.text,
      sourceUrl: dataset.attribution?.url,
      retrievedAt: dataset.retrievedAt,
    })),
    warnings: [warningForPlacement(placement)],
    recommendations: assessment.actions.flatMap((action, index) =>
      action.items.map((item) => ({
        phase: action.phase,
        priority: index + 1,
        title: item,
        reason: item,
      })),
    ),
    report: {
      analysisVersion: "mt-248-v1",
      title: "Preliminary pool feasibility assessment",
      summary: assessment.preliminaryFeasibilityWording,
      feasibilityState: warningState(placement),
      reportData: reportSnapshot(assessment),
    },
  };
}

export function buildFastSubmissionContext(
  result: FastPropertyViewResult,
  placement: FastPoolPlacementSnapshot,
): AssessmentSubmissionContext | null {
  if (
    !placement.dimensions ||
    !placement.poolGeometry ||
    !placement.constructionEnvelopeGeometry ||
    !placement.constructionEnvelopeWithinMappedArea
  ) {
    return null;
  }
  const warning = {
    state: placement.warning.status,
    code: `POOL_${placement.warning.status.toUpperCase()}`,
    title: placement.warning.label,
    message: placement.warning.text,
  } as const;
  return {
    addressEvidence: {
      selectedAddressId: result.resolvedAddress.addressId,
      formattedAddress: result.resolvedAddress.fullAddress,
      latitude: result.resolvedAddress.coordinates[1],
      longitude: result.resolvedAddress.coordinates[0],
      boundaryStatus:
        result.boundary.state === "loading"
          ? "unavailable"
          : result.boundary.state,
      boundaryAreaSquareMetres: result.boundary.areaSquareMetres,
      boundaryGeometry: result.boundary.geometry ?? undefined,
      parcelIdentifier: result.boundary.parcelId ?? undefined,
    },
    poolLayout: {
      lengthMetres: placement.dimensions.lengthMetres,
      widthMetres: placement.dimensions.widthMetres,
      rotationDegrees: placement.rotationDegrees,
      position: placement.position,
      shellGeometry: placement.poolGeometry.geometry,
      constructionEnvelopeGeometry:
        placement.constructionEnvelopeGeometry.geometry,
      clearancesVisible: placement.clearancesVisible ?? true,
    },
    layerStates:
      result.detailedChecks?.layers.map((layer) => ({
        provider: layer.evidence.provider,
        dataset: layer.evidence.dataset,
        datasetId: layer.evidence.datasetIdentifier,
        status:
          layer.state === "returned"
            ? ("returned" as const)
            : layer.state === "verified_empty"
              ? ("empty" as const)
              : layer.state === "internal_reference_only"
                ? ("internal_reference_only" as const)
                : layer.state === "provider_error" || layer.state === "timeout"
                  ? ("provider_error" as const)
                  : ("unavailable" as const),
        confidence: confidence(layer.evidence.confidence ?? "unknown"),
        attribution: layer.evidence.attribution?.text,
        sourceUrl: layer.evidence.attribution?.url,
        retrievedAt: layer.evidence.retrievedAt,
        featureCount: layer.evidence.featureCount,
      })) ?? [],
    warnings: [warning],
    recommendations: placement.warning.recommendation
      ? [
          {
            phase: "before_concept_design" as const,
            priority: 1,
            title: "Resolve the mapped pool warning",
            reason: placement.warning.recommendation,
          },
        ]
      : [],
    report: {
      analysisVersion: "mt-248-v1",
      title: "Preliminary pool feasibility assessment",
      summary: placement.warning.text,
      feasibilityState: placement.warning.status,
      reportData: {
        recommendation:
          placement.warning.recommendation ??
          "Review the saved mapped evidence before design.",
        preliminaryFeasibilityWording: placement.warning.text,
        risks: [],
        actions: [],
        missingInformation: [],
        limitations: result.detailedChecks?.limitations ?? [
          "Detailed official checks have not been loaded.",
        ],
        provenance: { datasets: [] },
        assessmentSnapshot: null,
      },
    },
  };
}

function layerStatus(status: string) {
  if (status === "success" || status === "available")
    return "returned" as const;
  if (status === "error") return "provider_error" as const;
  return "unavailable" as const;
}

function confidence(value: string) {
  if (value === "high" || value === "medium" || value === "low") return value;
  return "unknown" as const;
}

function warningState(placement: PropertyPoolPlacement) {
  return placement.classification === "hard_conflict"
    ? ("blocked" as const)
    : placement.classification === "unknown"
      ? ("needs_checking" as const)
      : ("no_warning" as const);
}

function warningForPlacement(placement: PropertyPoolPlacement) {
  const state = warningState(placement);
  return {
    state,
    code: `POOL_${state.toUpperCase()}`,
    title:
      state === "blocked"
        ? "Pool placement is blocked"
        : state === "needs_checking"
          ? "Pool placement needs checking"
          : "No mapped pool warning",
    message:
      state === "blocked"
        ? "Move the pool, or obtain an engineer-designed solution accepted by the relevant council or service owner."
        : state === "needs_checking"
          ? "Some mapped evidence is unavailable or uncertain."
          : "No reliable mapped conflict was identified in the saved evidence.",
  };
}

function reportSnapshot(assessment: SessionAssessment) {
  return {
    recommendation: assessment.recommendation,
    preliminaryFeasibilityWording: assessment.preliminaryFeasibilityWording,
    risks: assessment.risks,
    actions: assessment.actions,
    missingInformation: assessment.missingInformation,
    limitations: assessment.limitations,
    provenance: assessment.provenance,
    assessmentSnapshot: buildReportAssessmentSnapshot(assessment),
  };
}
