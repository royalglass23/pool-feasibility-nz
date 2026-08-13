"use client";

import { useEffect, useState } from "react";
import type { StaffAssessmentDetail as StaffAssessmentDetailModel } from "@/modules/staff/staff-assessment-read-model";
import { StaffAssessmentDetail } from "./staff-assessment-detail";

type SerializedAssessment = Omit<StaffAssessmentDetailModel, "createdAt"> & {
  createdAt: string;
};

type DetailState =
  | { status: "loading" }
  | { status: "ready"; assessment: StaffAssessmentDetailModel }
  | { status: "not_found" }
  | { status: "error"; message: string };

export function StaffAssessmentDetailClient({ id }: { id: string }) {
  const [state, setState] = useState<DetailState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    async function loadAssessment() {
      try {
        const response = await fetch(
          `/api/internal/assessments/${encodeURIComponent(id)}`,
          {
            cache: "no-store",
            credentials: "same-origin",
            signal: controller.signal,
          },
        );
        if (response.status === 404) {
          setState({ status: "not_found" });
          return;
        }
        if (!response.ok)
          throw new Error("The saved assessment could not be loaded.");
        const body = (await response.json()) as {
          data?: { assessment?: SerializedAssessment };
        };
        const assessment = body.data?.assessment;
        if (!assessment)
          throw new Error("The saved assessment is unavailable.");
        setState({
          status: "ready",
          assessment: {
            ...assessment,
            createdAt: new Date(assessment.createdAt),
          },
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "The saved assessment could not be loaded.",
        });
      }
    }

    void loadAssessment();
    return () => controller.abort();
  }, [id]);

  if (state.status === "loading") {
    return (
      <p
        role="status"
        className="rounded-3xl border border-pool-200 bg-white px-6 py-12 text-center text-sm font-semibold text-pool-600 shadow-sm"
      >
        Loading saved assessment…
      </p>
    );
  }

  if (state.status === "not_found") {
    return (
      <div
        role="alert"
        className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-5 text-amber-950"
      >
        <p className="font-semibold">Saved assessment not found</p>
        <p className="mt-1 text-sm">
          Return to the Staff dashboard and choose an available assessment.
        </p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div
        role="alert"
        className="rounded-3xl border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-900"
      >
        <p className="font-semibold">Staff detail unavailable</p>
        <p className="mt-1">{state.message}</p>
      </div>
    );
  }

  return (
    <StaffAssessmentDetail
      assessment={state.assessment}
      onBack={() => window.location.assign("/staff")}
    />
  );
}
