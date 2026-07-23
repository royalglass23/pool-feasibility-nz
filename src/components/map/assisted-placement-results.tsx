import type { AssistedPlacementCandidate, AssistedPlacementSearchResult } from "@/modules/spatial/find-assisted-pool-placements";

export function AssistedPlacementResults({
  result,
  onSelectCandidate,
}: {
  result: AssistedPlacementSearchResult | null;
  onSelectCandidate: (candidate: AssistedPlacementCandidate) => void;
}) {
  if (!result) return null;
  return (
    <div
      className="border-t border-slate-200 bg-slate-50 px-5 py-5"
      aria-label="Assisted placement search results"
      aria-live="polite"
    >
      <h4 className="font-semibold text-slate-950">Assisted placement options</h4>
      <p className="mt-1 text-sm text-slate-700">{result.message}</p>
      {result.candidates.length > 0 ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {result.candidates.map((candidate) => (
            <article
              key={candidate.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <p className="text-xs font-bold tracking-wide text-teal-800 uppercase">
                Option {candidate.rank}
              </p>
              <h5 className="mt-1 font-semibold text-slate-950">
                {candidate.role.replaceAll("_", " ")}
              </h5>
              <p className="mt-2 text-sm text-slate-700">{candidate.explanation}</p>
              <ul className="mt-3 space-y-1 text-xs leading-5 text-slate-600">
                {candidate.rankingEvidence.slice(0, 3).map((evidence) => (
                  <li key={evidence}>{evidence}</li>
                ))}
              </ul>
              {candidate.imageryFindings.length > 0 && (
                <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-950">
                  Advisory imagery finding: onsite inspection required.
                </p>
              )}
              <button
                type="button"
                onClick={() => onSelectCandidate(candidate)}
                className="mt-4 min-h-10 rounded-lg border border-teal-700 px-3 text-sm font-semibold text-teal-800 hover:bg-teal-50"
              >
                Show this option on map
              </button>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-medium text-amber-950">
          {result.status === "inspection_required"
            ? "Inspection is required before a clear candidate can be shown."
            : "No clear candidate is available for this size and evidence set."}
        </p>
      )}
    </div>
  );
}
