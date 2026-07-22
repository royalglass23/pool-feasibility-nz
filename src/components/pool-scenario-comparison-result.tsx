import type { DataAccessSpikeResult } from "@/modules/data-access-spike/run-data-access-spike";
import type { PoolScenarioStatus } from "@/modules/spatial/analyze-pool-scenarios";
import { humanizeIdentifierTitleCase as humanize } from "@/shared/text/humanize-identifier";

export function PoolScenarioComparisonResult({
  comparison,
}: {
  comparison: DataAccessSpikeResult["scenarioComparison"];
}) {
  const rankedScenarios = comparison.rankedScenarioIds.flatMap((scenarioId) => {
    const scenario = comparison.scenarios.find(
      (item) => item.scenario.id === scenarioId,
    );
    return scenario ? [scenario] : [];
  });

  return (
    <section
      aria-labelledby="pool-scenario-comparison-heading"
      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-teal-700 uppercase">
            Deterministic spatial screening
          </p>
          <h3
            id="pool-scenario-comparison-heading"
            className="mt-2 text-xl font-semibold text-slate-950"
          >
            Pool feasibility and size recommendation
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Configured shell sizes are tested against the available mapped
            evidence. The recommendation is the largest successfully placed
            shell within the best-supported feasibility status; geometry and
            safety checks are never relaxed.
          </p>
        </div>
        <div className="rounded-2xl bg-teal-50 px-4 py-3 text-sm ring-1 ring-teal-600/15">
          <p className="font-semibold text-teal-950">
            Recommended screened size
          </p>
          <p className="mt-1 text-lg font-bold text-teal-800">
            {comparison.recommendedShell
              ? `${comparison.recommendedShell.label} · ${formatShell(comparison.recommendedShell)}`
              : "No supported size recommendation"}
          </p>
          <p className="mt-1 text-xs text-teal-800">
            {comparison.recommendedShell?.rationale ??
              "Mapped evidence is insufficient for a size recommendation."}
          </p>
        </div>
      </div>

      <p className="mt-5 text-sm text-slate-600">
        {comparison.successfulShells.length} of {comparison.scenarios.length}{" "}
        tested shell sizes produced candidate geometry. A candidate is not an
        approved pool position.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {rankedScenarios.map((analysis) => {
          const candidate = analysis.candidates[0];
          return (
            <article
              key={analysis.scenario.id}
              className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    {analysis.scenario.kind === "anchor"
                      ? "Named anchor"
                      : "Configured intermediate"}
                  </p>
                  <h4 className="mt-1 font-semibold text-slate-950">
                    {analysis.scenario.label}
                  </h4>
                </div>
                <span className={statusClass(analysis.status)}>
                  {humanize(analysis.status)}
                </span>
              </div>
              <p className="mt-4 text-lg font-bold text-slate-900">
                {analysis.scenario.shellLengthMetres}m x{" "}
                {analysis.scenario.shellWidthMetres}m
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Rule {analysis.scenario.version}
              </p>
              {candidate ? (
                <p className="mt-4 text-sm leading-6 text-slate-700">
                  Suggested dimension linked to candidate {candidate.rank} at{" "}
                  {candidate.rotationDegrees} degrees.{" "}
                  {analysis.testedPlacementCount} placements were tested.
                </p>
              ) : (
                <p className="mt-4 text-sm leading-6 text-slate-700">
                  No successful candidate geometry supports this shell size.
                </p>
              )}
            </article>
          );
        })}
      </div>

      <p className="mt-5 text-xs leading-5 font-medium text-amber-800">
        Screening evidence only - no candidate is an approved design or pool
        position.
      </p>
    </section>
  );
}

function formatShell(shell: { lengthMetres: number; widthMetres: number }) {
  return `${shell.lengthMetres}m x ${shell.widthMetres}m`;
}

function statusClass(status: PoolScenarioStatus) {
  const tone =
    status === "likely"
      ? "bg-teal-50 text-teal-800 ring-teal-600/20"
      : status === "possible_with_constraints"
        ? "bg-blue-50 text-blue-800 ring-blue-600/20"
        : status === "specialist_review_required"
          ? "bg-orange-50 text-orange-800 ring-orange-600/20"
          : status === "no_clear_candidate"
            ? "bg-amber-50 text-amber-800 ring-amber-600/20"
            : "bg-slate-100 text-slate-700 ring-slate-500/20";
  return `inline-flex shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${tone}`;
}
