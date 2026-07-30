"use client";

import { useEffect, useState } from "react";
import type { StaffAssessmentSummary } from "@/modules/staff/staff-assessment-read-model";
import { StaffAssessmentDashboard } from "./staff-assessment-dashboard";

type DashboardState =
  | { status: "loading" }
  | { status: "ready"; assessments: StaffAssessmentSummary[] }
  | { status: "error"; message: string };

export function StaffAssessmentDashboardClient() {
  const [state, setState] = useState<DashboardState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    async function loadAssessments() {
      try {
        const response = await fetch("/api/internal/assessments", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error("The saved assessment register could not be loaded.");
        const body = (await response.json()) as {
          data?: {
            assessments?: Array<
              Omit<StaffAssessmentSummary, "createdAt"> & {
                createdAt: string;
              }
            >;
          };
        };
        if (!body.data?.assessments)
          throw new Error("The saved assessment register is unavailable.");
        setState({
          status: "ready",
          assessments: body.data.assessments.map((assessment) => ({
            ...assessment,
            createdAt: new Date(assessment.createdAt),
          })),
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "The saved assessment register could not be loaded.",
        });
      }
    }

    void loadAssessments();
    return () => controller.abort();
  }, []);

  if (state.status === "loading") {
    return (
      <p
        role="status"
        className="rounded-3xl border border-slate-200 bg-white px-6 py-12 text-center text-sm font-semibold text-slate-600 shadow-sm"
      >
        Loading saved assessments…
      </p>
    );
  }

  if (state.status === "error") {
    return (
      <div
        role="alert"
        className="rounded-3xl border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-900"
      >
        <p className="font-semibold">Staff dashboard unavailable</p>
        <p className="mt-1">{state.message}</p>
      </div>
    );
  }

  return <StaffAssessmentDashboard assessments={state.assessments} />;
}
