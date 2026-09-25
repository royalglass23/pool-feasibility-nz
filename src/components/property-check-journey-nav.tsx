"use client";

export const PROPERTY_CHECK_STAGES = [
  { id: "audience", title: "Who is this for?" },
  { id: "property", title: "Find the property" },
  { id: "placement", title: "Place your pool" },
  { id: "details", title: "Check the details" },
  { id: "contact", title: "Your details" },
  { id: "report", title: "Your property report" },
] as const;

export type PropertyCheckStage = (typeof PROPERTY_CHECK_STAGES)[number]["id"];

export function PropertyCheckJourneyNav({
  currentStage,
  completedStages,
  onNavigate,
}: {
  currentStage: PropertyCheckStage;
  completedStages: readonly PropertyCheckStage[];
  onNavigate: (stage: PropertyCheckStage) => void;
}) {
  const completed = new Set(completedStages);

  return (
    <nav aria-label="Property Check journey">
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        {PROPERTY_CHECK_STAGES.map((stage) => {
          const isCurrent = stage.id === currentStage;
          const isCompleted = completed.has(stage.id);
          const status = isCurrent
            ? "Current"
            : isCompleted
              ? "Completed"
              : "Locked";

          return (
            <li key={stage.id}>
              <button
                type="button"
                aria-current={isCurrent ? "step" : undefined}
                disabled={!isCurrent && !isCompleted}
                onClick={() => onNavigate(stage.id)}
                className="border-pool-200 text-pool-950 focus-visible:outline-pool-blue-700 aria-[current=step]:border-pool-blue-700 aria-[current=step]:bg-pool-blue-50 disabled:text-pool-500 hover:border-pool-blue-500 flex min-h-16 w-full flex-col items-start justify-center rounded-[3px] border bg-white px-3 py-2 text-left text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:bg-slate-50"
              >
                <span>{stage.title}</span>
                <span className="text-pool-600 text-xs font-normal">
                  {status}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
