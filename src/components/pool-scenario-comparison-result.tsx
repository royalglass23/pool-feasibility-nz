import type { DataAccessSpikeResult } from "@/modules/data-access-spike/run-data-access-spike";
import type { PoolScenarioStatus } from "@/modules/spatial/analyze-pool-scenarios";

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
  const sharedStatus =
    rankedScenarios.length > 0 &&
    rankedScenarios.every(
      (analysis) => analysis.status === rankedScenarios[0]?.status,
    )
      ? rankedScenarios[0]!.status
      : null;
  const successfulCount = comparison.successfulShells.length;
  const recommendedShell = comparison.recommendedShell
    ? comparison.successfulShells.some(
        (shell) => shell.scenarioId === comparison.recommendedShell?.scenarioId,
      )
      ? comparison.recommendedShell
      : null
    : null;
  const statusGroups = rankedScenarios.reduce<
    Array<{ status: PoolScenarioStatus; labels: string[] }>
  >((groups, analysis) => {
    const group = groups.find(({ status }) => status === analysis.status);
    if (group) {
      group.labels.push(analysis.scenario.label);
    } else {
      groups.push({
        status: analysis.status,
        labels: [analysis.scenario.label],
      });
    }
    return groups;
  }, []);

  return (
    <section aria-labelledby="pool-scenario-comparison-heading">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3
            id="pool-scenario-comparison-heading"
            className="text-xl font-semibold text-balance text-slate-950"
          >
            Pool size screening
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-pretty text-slate-700">
            We checked {rankedScenarios.length} common pool sizes against the
            available property information. The largest size with a possible
            position is shown here. A site visit and specialist checks are still
            required before design or construction.
          </p>
        </div>
        <div className="rounded-2xl bg-teal-50 px-4 py-3 text-sm ring-1 ring-teal-600/15 lg:min-w-80">
          <p className="font-semibold text-teal-950">Largest potential fit</p>
          <p className="mt-1 text-lg font-bold text-teal-800">
            {recommendedShell
              ? `${recommendedShell.label} · ${formatShell(recommendedShell)}`
              : "No pool size can be recommended yet"}
          </p>
          <p className="mt-1 text-sm leading-5 text-teal-900">
            {recommendedShell
              ? "A possible position was found using the available property information."
              : "The available property information does not support a size recommendation."}
          </p>
        </div>
      </div>

      <p className="mt-5 text-sm font-medium text-slate-800">
        {successfulCount > 0
          ? `Possible positions found for ${successfulCount} of ${rankedScenarios.length} sizes.`
          : `No possible positions found for the ${rankedScenarios.length} sizes checked.`}
      </p>

      {sharedStatus && (
        <div className={sharedStatusClass(sharedStatus)}>
          <p className="text-sm font-semibold">
            {sharedResultTitle(sharedStatus)}
          </p>
          <p className="mt-1 text-sm leading-6">
            {statusExplanation(sharedStatus)}
          </p>
        </div>
      )}

      {!sharedStatus && (
        <ul className="mt-4 space-y-2" aria-label="Results by pool size">
          {statusGroups.map(({ status, labels }) => (
            <li key={status} className="text-sm leading-6 text-slate-700">
              <span className="font-semibold text-slate-950">
                {formatList(labels)}:
              </span>{" "}
              <span className={statusTextClass(status)}>
                {statusLabel(status)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="grid grid-cols-[1fr_auto] gap-4 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 sm:grid-cols-[1fr_10rem]">
          <span>Pool size</span>
          <span>Dimensions</span>
        </div>
        <ul className="divide-y divide-slate-200">
          {rankedScenarios.map((analysis) => (
            <li
              key={analysis.scenario.id}
              className="grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-3 sm:grid-cols-[1fr_10rem]"
            >
              <h4 className="font-semibold text-slate-950">
                {analysis.scenario.label}
              </h4>
              <p className="text-sm font-medium whitespace-nowrap text-slate-800">
                {formatShell({
                  lengthMetres: analysis.scenario.shellLengthMetres,
                  widthMetres: analysis.scenario.shellWidthMetres,
                })}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-4 text-sm leading-5 font-medium text-amber-900">
        This is an early screening result, not an approved pool design or
        position.
      </p>
    </section>
  );
}

function formatShell(shell: { lengthMetres: number; widthMetres: number }) {
  return `${shell.lengthMetres}m × ${shell.widthMetres}m`;
}

function formatList(items: string[]) {
  if (items.length < 2) return items[0];
  if (items.length === 2) return items.join(" and ");
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function statusLabel(status: PoolScenarioStatus) {
  switch (status) {
    case "likely":
      return "Potential fit";
    case "possible_with_constraints":
      return "Possible fit — site checks needed";
    case "specialist_review_required":
      return "Possible fit — specialist review needed";
    case "no_clear_candidate":
      return "No clear fit found";
    case "insufficient_data":
      return "Cannot assess yet";
  }
}

function sharedResultTitle(status: PoolScenarioStatus) {
  switch (status) {
    case "likely":
      return "All sizes show a potential fit";
    case "possible_with_constraints":
      return "All sizes may fit, with site checks";
    case "specialist_review_required":
      return "All sizes need specialist review";
    case "no_clear_candidate":
      return "No clear fit for any size";
    case "insufficient_data":
      return "Not enough information to assess the sizes";
  }
}

function statusExplanation(status: PoolScenarioStatus) {
  switch (status) {
    case "likely":
      return "The available property information supports a possible pool position.";
    case "possible_with_constraints":
      return "Possible positions were found, but mapped property features may affect the final position.";
    case "specialist_review_required":
      return "Possible positions were found, but important details cannot be confirmed from the available maps.";
    case "no_clear_candidate":
      return "No clear pool position was found using the available property information.";
    case "insufficient_data":
      return "There is not enough mapped property information to assess these pool sizes.";
  }
}

function sharedStatusClass(status: PoolScenarioStatus) {
  const tone =
    status === "likely"
      ? "bg-teal-50 text-teal-950 ring-teal-600/20"
      : status === "possible_with_constraints"
        ? "bg-blue-50 text-blue-950 ring-blue-600/20"
        : status === "specialist_review_required"
          ? "bg-orange-50 text-orange-950 ring-orange-600/20"
          : status === "no_clear_candidate"
            ? "bg-amber-50 text-amber-950 ring-amber-600/20"
            : "bg-slate-100 text-slate-900 ring-slate-500/20";
  return `mt-4 rounded-xl px-4 py-3 ring-1 ${tone}`;
}

function statusTextClass(status: PoolScenarioStatus) {
  return status === "likely"
    ? "font-semibold text-teal-800"
    : status === "possible_with_constraints"
      ? "font-semibold text-blue-800"
      : status === "specialist_review_required"
        ? "font-semibold text-orange-800"
        : status === "no_clear_candidate"
          ? "font-semibold text-amber-800"
          : "font-semibold text-slate-700";
}
