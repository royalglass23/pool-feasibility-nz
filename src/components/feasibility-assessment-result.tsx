import type { DataAccessSpikeResult } from "@/modules/data-access-spike/run-data-access-spike";
import { humanizeIdentifier as humanize } from "@/shared/text/humanize-identifier";

export function FeasibilityAssessmentResult({
  assessment,
}: {
  assessment: DataAccessSpikeResult["feasibilityAssessment"];
}) {
  return (
    <section
      aria-labelledby="feasibility-assessment-heading"
      className="border-pool-200 rounded-3xl border bg-white p-5 shadow-sm sm:p-6"
    >
      <p className="text-pool-blue-700 text-xs font-bold tracking-[0.18em] uppercase">
        Versioned deterministic rules
      </p>
      <h3
        id="feasibility-assessment-heading"
        className="text-pool-950 mt-2 text-xl font-semibold"
      >
        Feasibility assessment
      </h3>
      <p className="text-pool-600 mt-2 max-w-3xl text-sm leading-6">
        Physical feasibility and data confidence are separate. Unknown evidence
        is not treated as proof that a constraint is absent.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Summary
          label="Feasibility score"
          value={
            assessment.score === null
              ? "Not scored"
              : `${assessment.score} / 100`
          }
        />
        <Summary
          label="Final recommendation"
          value={assessment.finalRecommendation}
        />
        <Summary
          label="Result band"
          value={
            assessment.band === null
              ? "Indeterminate"
              : humanize(assessment.band)
          }
        />
        <Summary
          label="Evidence quality"
          value={`${humanize(assessment.confidence.level)} data confidence`}
        />
      </div>

      {assessment.qualification !== "normal" ? (
        <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 ring-1 ring-amber-600/20">
          Final qualification: {humanize(assessment.qualification)}
        </p>
      ) : null}

      {assessment.criticalFlags.length > 0 ? (
        <div className="mt-5">
          <h4 className="text-pool-950 font-semibold">Critical flags</h4>
          <ul className="mt-3 space-y-2 text-sm text-amber-900">
            {assessment.criticalFlags.map((flag) => (
              <li
                key={flag.id}
                className="rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-600/15"
              >
                <span className="font-semibold">{humanize(flag.id)}:</span>{" "}
                {flag.rationale}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        {assessment.categories.map((category) => (
          <article
            key={category.id}
            className="border-pool-200 bg-pool-50/70 rounded-2xl border p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <h4 className="text-pool-950 font-semibold">
                {humanize(category.id)}
              </h4>
              <span className="text-pool-700 ring-pool-300 rounded-sm bg-white px-2.5 py-1 text-xs font-bold ring-1">
                {category.awardedPoints === null
                  ? `Unknown / ${category.maximumPoints}`
                  : `${category.awardedPoints} / ${category.maximumPoints}`}
              </span>
            </div>
            <p className="text-pool-600 mt-3 text-sm leading-6">
              {category.rationale}
            </p>
            {category.unknownInputs.length > 0 ? (
              <p className="mt-2 text-xs font-medium text-amber-800">
                Unknown: {category.unknownInputs.map(humanize).join(", ")}
              </p>
            ) : null}
          </article>
        ))}
      </div>

      <p className="text-pool-500 mt-5 text-xs leading-5">
        Rule {assessment.analysisVersion}. The score is normalized across known
        physical categories; unknown categories lower confidence instead of
        receiving zero points.
      </p>
    </section>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-pool-50 rounded-2xl px-4 py-3">
      <p className="text-pool-500 text-xs font-semibold tracking-wide uppercase">
        {label}
      </p>
      <p className="text-pool-950 mt-2 font-bold">{value}</p>
    </div>
  );
}
