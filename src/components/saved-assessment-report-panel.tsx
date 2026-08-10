"use client";

import { useCallback, useState } from "react";
import type { SavedAssessmentResponse } from "@/components/homeowner-submission-form";
import { SavedPreliminaryReportView } from "@/components/saved-preliminary-report-view";

export function useSavedAssessmentReport() {
  const [assessment, setAssessment] = useState<SavedAssessmentResponse | null>(
    null,
  );
  const [showReport, setShowReport] = useState(false);

  return {
    assessment,
    showReport,
    saveAssessment: useCallback((saved: SavedAssessmentResponse) => {
      setAssessment(saved);
      setShowReport(true);
    }, []),
    openReport: useCallback(() => setShowReport(true), []),
    closeReport: useCallback(() => setShowReport(false), []),
    resetReport: useCallback(() => {
      setAssessment(null);
      setShowReport(false);
    }, []),
  };
}

export function SavedAssessmentReportPanel({
  assessment,
  showReport,
  onOpen,
  onBack,
}: {
  assessment: SavedAssessmentResponse;
  showReport: boolean;
  onOpen: () => void;
  onBack: () => void;
}) {
  if (showReport) {
    return (
      <SavedPreliminaryReportView
        report={assessment.report}
        delivery={assessment.delivery}
        onBack={onBack}
        downloadAccessToken={assessment.reportAccessToken}
      />
    );
  }

  return (
    <div
      role="status"
      className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950"
    >
      <p className="font-semibold">Assessment saved</p>
      <p className="mt-1 text-sm">
        Reference {assessment.reference}. Your saved preliminary report is
        ready.
      </p>
      <button
        type="button"
        onClick={onOpen}
        className="mt-4 min-h-10 rounded-xl bg-emerald-800 px-4 font-semibold text-white"
      >
        Open report
      </button>
    </div>
  );
}
