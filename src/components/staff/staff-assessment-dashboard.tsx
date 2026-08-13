import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  staffFeasibilityLabels,
  type StaffAssessmentSummary,
  type StaffFeasibilityState,
} from "@/modules/staff/staff-assessment-read-model";

const submittedDate = new Intl.DateTimeFormat("en-NZ", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Pacific/Auckland",
});

const timingLabels: Record<string, string> = {
  asap: "ASAP",
  "3_months": "3 months",
  "6_months": "6 months",
  "12_months": "12 months",
};

const feasibilityClasses: Record<StaffFeasibilityState, string> = {
  no_warning:
    "border-emerald-700/20 bg-emerald-50 text-emerald-800 before:bg-emerald-600",
  needs_checking:
    "border-amber-700/20 bg-amber-50 text-amber-900 before:bg-amber-500",
  blocked: "border-red-700/20 bg-red-50 text-red-800 before:bg-red-600",
};

export function StaffAssessmentDashboard({
  assessments,
}: {
  assessments: StaffAssessmentSummary[];
}) {
  if (assessments.length === 0) {
    return (
      <section className="rounded-3xl border border-pool-200 bg-white px-6 py-16 text-center shadow-sm">
        <p className="text-xs font-bold tracking-[0.18em] text-pool-blue-700 uppercase">
          Submission register
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-pool-950">
          No saved assessments yet
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-pool-600">
          New homeowner submissions will appear here in submitted order.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="staff-assessments-heading">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-pool-blue-700 uppercase">
            Submission register
          </p>
          <h2
            id="staff-assessments-heading"
            className="mt-2 text-2xl font-semibold tracking-tight text-pool-950"
          >
            Saved assessments
          </h2>
        </div>
        <p className="text-sm text-pool-500">
          {assessments.length}{" "}
          {assessments.length === 1 ? "assessment" : "assessments"} · newest
          first
        </p>
      </div>

      <ol className="space-y-3">
        {assessments.map((assessment) => (
          <li key={assessment.id}>
            <article className="group relative overflow-hidden rounded-3xl border border-pool-200 bg-white shadow-sm transition hover:-tranpool-y-0.5 hover:border-pool-blue-700/30 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none">
              <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(12rem,0.65fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h3 className="text-lg font-semibold text-pool-950">
                      {assessment.homeownerName}
                    </h3>
                    <span className="font-mono text-xs font-semibold text-pool-500">
                      {assessment.reference}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm text-pool-600">
                    {assessment.homeownerAddress}
                  </p>
                  <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                    <div>
                      <dt className="text-xs font-semibold tracking-wide text-pool-500 uppercase">
                        Submitted
                      </dt>
                      <dd className="mt-1 font-medium text-pool-800">
                        <time dateTime={assessment.createdAt.toISOString()}>
                          {submittedDate.format(assessment.createdAt)}
                        </time>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold tracking-wide text-pool-500 uppercase">
                        Timing
                      </dt>
                      <dd className="mt-1 font-medium text-pool-800">
                        {timingLabels[assessment.desiredTiming] ??
                          assessment.desiredTiming}
                      </dd>
                    </div>
                  </dl>
                </div>

                <FeasibilityBadge assessment={assessment} />

                <Link
                  href={`/staff/${assessment.id}`}
                  prefetch={false}
                  aria-label={`Open ${assessment.reference}`}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-pool-950 px-4 py-2 text-sm font-semibold text-white outline-offset-4 transition group-hover:bg-pool-blue-800 hover:bg-pool-blue-800 focus-visible:outline-2 focus-visible:outline-pool-blue-700"
                >
                  View detail
                  <ArrowUpRight aria-hidden="true" className="size-4" />
                </Link>
              </div>
            </article>
          </li>
        ))}
      </ol>
    </section>
  );
}

function FeasibilityBadge({
  assessment,
}: {
  assessment: StaffAssessmentSummary;
}) {
  const label = staffFeasibilityLabels[assessment.feasibilityState];
  const className = feasibilityClasses[assessment.feasibilityState];
  const rotation = Math.round(assessment.poolLayout.rotationDegrees);
  const accessibleLabel = `${label}: saved ${assessment.poolLayout.lengthMetres} by ${assessment.poolLayout.widthMetres} metre pool at ${rotation} degrees with ${assessment.evidenceCount} evidence records.`;

  return (
    <div
      aria-label={accessibleLabel}
      className={`relative rounded-2xl border py-3 pr-4 pl-6 before:absolute before:inset-y-3 before:left-3 before:w-1 before:rounded-full ${className}`}
    >
      <p className="text-xs font-bold tracking-wide uppercase">{label}</p>
      <p className="mt-1 text-xs leading-5">
        {assessment.poolLayout.lengthMetres} ×{" "}
        {assessment.poolLayout.widthMetres} m · {rotation}° ·{" "}
        {assessment.evidenceCount} evidence{" "}
        {assessment.evidenceCount === 1 ? "record" : "records"}
      </p>
    </div>
  );
}
