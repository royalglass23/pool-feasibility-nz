"use client";

import { HomeownerFeasibilityReportView } from "@/components/homeowner-feasibility-report-view";
import { getProjectTimingLabel } from "@/modules/assessment/visitor-context";
import { getVisitorTypeLabel } from "@/modules/assessment/visitor-type";
import type { StaffAssessmentDetail as StaffAssessmentDetailModel } from "@/modules/staff/staff-assessment-read-model";

const submittedDate = new Intl.DateTimeFormat("en-NZ", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Pacific/Auckland",
});

export function StaffAssessmentDetail({
  assessment,
  onBack,
}: {
  assessment: StaffAssessmentDetailModel;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6">
      <section
        aria-labelledby="staff-homeowner-heading"
        className="border-pool-200 rounded-3xl border bg-white p-5 shadow-sm sm:p-8"
      >
        <div className="border-pool-200 flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-pool-blue-700 font-mono text-xs font-semibold">
              {assessment.reference}
            </p>
            <h1
              id="staff-homeowner-heading"
              className="text-pool-950 mt-2 text-2xl font-semibold tracking-tight"
            >
              {assessment.homeownerName}
            </h1>
            <p className="text-pool-600 mt-1 text-sm">
              {assessment.homeownerAddress}
            </p>
          </div>
          <p className="border-pool-200 bg-pool-50 text-pool-700 rounded-sm border px-3 py-1.5 text-xs font-bold tracking-wide uppercase">
            Read-only saved submission
          </p>
        </div>

        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Phone" value={assessment.homeownerPhone} />
          <Fact label="Email" value={assessment.homeownerEmail} />
          <Fact
            label="I am a"
            value={
              assessment.visitorType === null
                ? "Not captured"
                : assessment.visitorType === "other"
                  ? (assessment.visitorTypeOtherDetail ?? "Other")
                  : getVisitorTypeLabel(assessment.visitorType)
            }
          />
          <Fact
            label="Submitted"
            value={submittedDate.format(assessment.createdAt)}
          />
          <Fact
            label="Desired timing"
            value={
              assessment.desiredTiming === "other"
                ? (assessment.desiredTimingOtherDetail ?? "Other")
                : getProjectTimingLabel(assessment.desiredTiming)
            }
          />
          <Fact
            label="Boundary status"
            value={humanize(assessment.boundaryStatus)}
          />
          <Fact label="Submission status" value={humanize(assessment.status)} />
        </dl>

        {assessment.additionalInfo && (
          <div className="border-pool-200 bg-pool-50 mt-5 rounded-2xl border p-4">
            <p className="text-pool-500 text-xs font-bold tracking-wide uppercase">
              Additional information
            </p>
            <p className="text-pool-700 mt-2 text-sm leading-6">
              {assessment.additionalInfo}
            </p>
          </div>
        )}
      </section>

      <HomeownerFeasibilityReportView
        report={assessment.report}
        delivery={{
          homeowner: assessment.emailDeliveryState,
          internal_test_report: assessment.forwardingState,
        }}
        onBack={onBack}
      />
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-pool-500 text-xs font-bold tracking-wide uppercase">
        {label}
      </dt>
      <dd className="text-pool-900 mt-1 font-medium break-words">{value}</dd>
    </div>
  );
}

function humanize(value: string) {
  return value.replaceAll("_", " ");
}
