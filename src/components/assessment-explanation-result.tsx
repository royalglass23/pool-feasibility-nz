import type { AssessmentExplanation } from "@/modules/recommendations/generate-assessment-explanation";

export function AssessmentExplanationResult({
  explanation,
}: {
  explanation: AssessmentExplanation;
}) {
  const isAi = explanation.source === "ai";

  return (
    <section
      aria-labelledby="assessment-explanation-heading"
      className="rounded-3xl border border-teal-200 bg-teal-50/60 p-5 shadow-sm sm:p-6"
    >
      <p className="text-xs font-bold tracking-[0.18em] text-teal-800 uppercase">
        {isAi ? "Constrained AI narrative" : "Deterministic fallback"}
      </p>
      <h3
        id="assessment-explanation-heading"
        className="mt-2 text-xl font-semibold text-slate-950"
      >
        {explanation.heading}
      </h3>
      <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
        {explanation.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-xs leading-5 font-semibold text-slate-700 ring-1 ring-teal-700/15">
        AI does not calculate or change the deterministic score, confidence,
        critical flags, geometry, rankings, or size range.
      </p>
    </section>
  );
}
