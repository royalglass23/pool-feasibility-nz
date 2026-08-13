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
        className="rounded-3xl border border-pool-200 bg-white p-5 shadow-sm sm:p-8"
      >
        <div className="flex flex-col gap-3 border-b border-pool-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-mono text-xs font-semibold text-pool-blue-700">
              {assessment.reference}
            </p>
            <h1
              id="staff-homeowner-heading"
              className="mt-2 text-2xl font-semibold tracking-tight text-pool-950"
            >
              {assessment.homeownerName}
            </h1>
            <p className="mt-1 text-sm text-pool-600">
              {assessment.homeownerAddress}
            </p>
          </div>
          <p className="rounded-full border border-pool-200 bg-pool-50 px-3 py-1.5 text-xs font-bold tracking-wide text-pool-700 uppercase">
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
          <div className="mt-5 rounded-2xl border border-pool-200 bg-pool-50 p-4">
            <p className="text-xs font-bold tracking-wide text-pool-500 uppercase">
              Additional information
            </p>
            <p className="mt-2 text-sm leading-6 text-pool-700">
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
      <dt className="text-xs font-bold tracking-wide text-pool-500 uppercase">
        {label}
      </dt>
      <dd className="mt-1 font-medium break-words text-pool-900">{value}</dd>
    </div>
  );
}

function humanize(value: string) {
  return value.replaceAll("_", " ");
}
