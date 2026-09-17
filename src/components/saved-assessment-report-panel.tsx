"use client";

import { useCallback, useEffect, useState } from "react";
import type { SavedAssessmentResponse } from "@/components/homeowner-submission-form";
import { HomeownerFeasibilityReportView } from "@/components/homeowner-feasibility-report-view";
import {
  hasAnalyticsConsent,
  trackAnonymousFunnelEvent,
} from "@/modules/anonymous-funnel-analytics";

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
  onStartAgain,
}: {
  assessment: SavedAssessmentResponse;
  showReport: boolean;
  onOpen: () => void;
  onBack: () => void;
  onStartAgain?: () => void;
}) {
  useEffect(() => {
    if (!hasAnalyticsConsent()) return;

    const abort = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const retryDelaysMs = [2_000, 4_000, 8_000, 16_000, 30_000];

    async function checkDeliveryStatus() {
      if (abort.signal.aborted || !hasAnalyticsConsent()) return;
      attempts += 1;
      try {
        const response = await fetch(
          "/api/public/assessments/report/delivery/status",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accessToken: assessment.reportAccessToken }),
            cache: "no-store",
            signal: abort.signal,
          },
        );
        if (response.status === 401 || response.status === 404) return;
        if (response.ok) {
          const body: unknown = await response.json();
          const outcomeCategory = confirmedDeliveryOutcome(body);
          if (outcomeCategory) {
            if (!abort.signal.aborted) {
              trackAnonymousFunnelEvent({
                name: "report_delivery_outcome",
                outcomeCategory,
              });
            }
            return;
          }
        }
      } catch {
        if (abort.signal.aborted) return;
      }
      const retryDelay = retryDelaysMs[attempts - 1];
      if (!abort.signal.aborted && retryDelay !== undefined) {
        timeout = setTimeout(checkDeliveryStatus, retryDelay);
      }
    }

    void checkDeliveryStatus();
    return () => {
      abort.abort();
      if (timeout) clearTimeout(timeout);
    };
  }, [assessment.id, assessment.reportAccessToken]);

  if (showReport) {
    return (
      <HomeownerFeasibilityReportView
        report={assessment.report}
        delivery={assessment.delivery}
        onBack={onBack}
        showBackAction={false}
        onStartAgain={onStartAgain}
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

function confirmedDeliveryOutcome(
  body: unknown,
): "delivered" | "partial" | "failed" | null {
  if (!body || typeof body !== "object" || !("delivery" in body)) return null;
  const delivery = body.delivery;
  if (!delivery || typeof delivery !== "object") return null;
  if (!("homeowner" in delivery) || !("internal_test_report" in delivery)) {
    return null;
  }
  const { homeowner, internal_test_report } = delivery;
  if (homeowner === "sent" && internal_test_report === "sent") {
    return "delivered";
  }
  if (homeowner === "failed" && internal_test_report === "failed") {
    return "failed";
  }
  if (
    (homeowner === "sent" && internal_test_report === "failed") ||
    (homeowner === "failed" && internal_test_report === "sent")
  ) {
    return "partial";
  }
  return null;
}
