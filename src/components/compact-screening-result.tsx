import type { DataAccessSpikeResult } from "@/modules/data-access-spike/run-data-access-spike";

export function CompactScreeningResult({
  analysis,
}: {
  analysis: DataAccessSpikeResult["compactAnalysis"];
}) {
  const envelopeLength =
    analysis.scenario.shellLengthMetres +
    analysis.scenario.constructionAllowanceMetres * 2;
  const envelopeWidth =
    analysis.scenario.shellWidthMetres +
    analysis.scenario.constructionAllowanceMetres * 2;
  const statusClass =
    analysis.status === "candidates_found"
      ? "bg-teal-50 text-teal-800 ring-teal-600/20"
      : analysis.status === "no_clear_candidate"
        ? "bg-amber-50 text-amber-800 ring-amber-600/20"
        : "bg-slate-100 text-slate-700 ring-slate-500/20";

  return (
    <section
      aria-labelledby="compact-screening-heading"
      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-teal-700 uppercase">
            Deterministic spatial screening
          </p>
          <h3
            id="compact-screening-heading"
            className="mt-2 text-xl font-semibold text-slate-950"
          >
            Compact screening result
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            {analysis.scenario.label} shell{" "}
            {analysis.scenario.shellLengthMetres}m x{" "}
            {analysis.scenario.shellWidthMetres}m - indicative construction
            envelope {envelopeLength}m x {envelopeWidth}m
          </p>
        </div>
        <span
          className={`inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ${statusClass}`}
        >
          {humanize(analysis.status)}
        </span>
      </div>

      <p className="mt-5 max-w-4xl text-sm leading-6 text-slate-700">
        {analysis.resultWording}
      </p>
      <p className="mt-2 text-xs leading-5 font-medium text-amber-800">
        Screening evidence only - no candidate is an approved design or pool
        position.
      </p>

      {analysis.candidates.length > 0 ? (
        <div className="mt-6">
          <p className="text-sm font-semibold text-slate-950">
            {analysis.candidates.length} ranked candidate
            {analysis.candidates.length === 1 ? "" : "s"}
          </p>
          <div className="mt-3 grid gap-4 lg:grid-cols-3">
            {analysis.candidates.map((candidate) => {
              const availableConstraints =
                candidate.constraintIntersections.filter(
                  (measurement) => measurement.status === "measured",
                ).length;
              const intersectingConstraints =
                candidate.constraintIntersections.filter(
                  (measurement) => measurement.intersects,
                ).length;
              const unknownConstraints =
                candidate.constraintIntersections.length - availableConstraints;
              const nearestService = candidate.mappedServiceDistances
                .flatMap((measurement) =>
                  measurement.distanceMetres === null
                    ? []
                    : [measurement.distanceMetres],
                )
                .sort((left, right) => left - right)[0];

              return (
                <article
                  key={candidate.id}
                  className="rounded-2xl border border-teal-100 bg-teal-50/40 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="font-semibold text-slate-950">
                      Candidate {candidate.rank}
                    </h4>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-teal-800 ring-1 ring-teal-600/20">
                      Rank {candidate.rank}
                    </span>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-slate-500">Rotation</dt>
                      <dd className="font-semibold text-slate-900">
                        {candidate.rotationDegrees} degrees
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Constraint evidence</dt>
                      <dd className="font-semibold text-slate-900">
                        {intersectingConstraints} intersections across{" "}
                        {availableConstraints}
                        {unknownConstraints > 0
                          ? ` available; ${unknownConstraints} unknown`
                          : " available"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Nearest mapped service</dt>
                      <dd className="font-semibold text-slate-900">
                        {nearestService === undefined
                          ? "Unknown"
                          : `${nearestService.toFixed(1)} m`}
                      </dd>
                    </div>
                  </dl>
                  <ul className="mt-4 list-disc space-y-1.5 pl-5 text-xs leading-5 text-slate-600">
                    {candidate.rankingEvidence.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </div>
      ) : (
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <dt className="text-slate-500">Placements tested</dt>
            <dd className="mt-1 font-semibold text-slate-900">
              {analysis.testedPlacementCount}
            </dd>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <dt className="text-slate-500">Rotations</dt>
            <dd className="mt-1 font-semibold text-slate-900">
              {analysis.testedRotationsDegrees.join(", ")} degrees
            </dd>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <dt className="text-slate-500">Usable mapped area</dt>
            <dd className="mt-1 font-semibold text-slate-900">
              {analysis.usableAreaSquareMetres === null
                ? "Unknown"
                : `${analysis.usableAreaSquareMetres.toFixed(1)} m2`}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}

function humanize(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
