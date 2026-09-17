import type { SessionAssessment } from "@/modules/assessment/build-session-assessment";
import { humanizeIdentifier as humanize } from "@/shared/text/humanize-identifier";

export function SessionAssessmentResult({
  assessment,
}: {
  assessment: SessionAssessment;
}) {
  return (
    <section
      aria-labelledby="session-assessment-heading"
      className="border-pool-200 rounded-3xl border bg-white p-5 shadow-sm sm:p-6"
    >
      <p className="text-pool-blue-700 text-xs font-bold tracking-[0.18em] uppercase">
        Preliminary feasibility only
      </p>
      <h3
        id="session-assessment-heading"
        className="text-pool-950 mt-2 text-xl font-semibold"
      >
        Session assessment
      </h3>
      <p className="text-pool-600 mt-2 max-w-4xl text-sm leading-6">
        {assessment.preliminaryFeasibilityWording}
      </p>
      <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950 ring-1 ring-amber-600/20">
        {assessment.session.notice}
      </p>

      <div className="mt-6">
        <h4 className="text-pool-950 font-semibold">Sourced risks</h4>
        <div className="mt-3 space-y-3">
          {assessment.risks.map((risk) => (
            <article
              key={risk.id}
              className="border-pool-200 bg-pool-50/70 rounded-2xl border p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-pool-blue-700 text-xs font-bold tracking-wide uppercase">
                    {risk.category}
                  </p>
                  <h5 className="text-pool-950 mt-1 font-semibold">
                    {risk.title}
                  </h5>
                </div>
                <p className="text-pool-700 ring-pool-300 rounded-sm bg-white px-2.5 py-1 text-xs font-bold ring-1">
                  {humanize(risk.severity)} severity ·{" "}
                  {humanize(risk.confidence)} confidence
                </p>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <RiskDetail label="Evidence" value={risk.evidence} />
                <RiskDetail label="Source" value={risk.source} />
                <RiskDetail label="Impact" value={risk.impact} />
                <RiskDetail label="Action" value={risk.action} />
              </dl>
              <p className="text-pool-600 mt-3 text-xs font-semibold">
                Specialist review{" "}
                {risk.specialistReviewRequired ? "required" : "not required"}
              </p>
            </article>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <h4 className="text-pool-950 font-semibold">Ordered actions</h4>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {assessment.actions.map((group) => (
            <article
              key={group.phase}
              className="border-pool-200 rounded-2xl border p-4"
            >
              <h5 className="text-pool-950 font-semibold">
                {humanize(group.phase)}
              </h5>
              <ol className="text-pool-600 mt-3 list-decimal space-y-2 pl-5 text-sm leading-6">
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div>
          <h4 className="text-pool-950 font-semibold">
            Unverified information
          </h4>
          <ul className="text-pool-700 mt-3 space-y-2 text-sm">
            {assessment.missingInformation.map((item) => (
              <li key={item.id}>
                {item.label} — <span className="font-semibold">unverified</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-pool-950 font-semibold">Limitations</h4>
          <ul className="text-pool-700 mt-3 space-y-2 text-sm leading-6">
            {assessment.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-6">
        <h4 className="text-pool-950 font-semibold">Dataset provenance</h4>
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {assessment.provenance.datasets.map((dataset) => (
            <details
              key={dataset.id}
              className="border-pool-200 rounded-2xl border px-4 py-3"
            >
              <summary className="text-pool-900 cursor-pointer text-sm font-semibold">
                {humanize(dataset.id)} — {humanize(dataset.status)}
              </summary>
              <dl className="text-pool-600 mt-3 space-y-2 text-xs">
                <RiskDetail label="Provider" value={dataset.provider} />
                <RiskDetail label="Dataset" value={dataset.dataset} />
                <RiskDetail
                  label="Dataset identifier"
                  value={dataset.datasetIdentifier}
                />
                <RiskDetail label="Retrieved" value={dataset.retrievedAt} />
                <RiskDetail
                  label="Dataset date"
                  value={dataset.datasetDate ?? "Not published"}
                />
                <RiskDetail label="Licence" value={dataset.licence} />
                <RiskDetail
                  label="Attribution"
                  value={dataset.attribution?.text ?? "Not supplied"}
                />
                <RiskDetail
                  label="Evidence use"
                  value={humanize(dataset.evidenceUse)}
                />
                <RiskDetail
                  label="Confidence"
                  value={humanize(dataset.confidence)}
                />
                {dataset.availabilityNote ? (
                  <RiskDetail
                    label="Availability"
                    value={dataset.availabilityNote}
                  />
                ) : null}
              </dl>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function RiskDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-pool-800 font-semibold">{label}</dt>
      <dd className="mt-0.5 leading-5">{value}</dd>
    </div>
  );
}
