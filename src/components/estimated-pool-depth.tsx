"use client";

import { parseEstimatedPoolDepth } from "@/modules/assessment/estimated-pool-depth";

export function EstimatedPoolDepth({
  value,
  locked,
  onChange,
  onEdit,
}: {
  value: string;
  locked: boolean;
  onChange: (value: string) => void;
  onEdit?: () => void;
}) {
  const depth = parseEstimatedPoolDepth(value);
  const isValidSliderDepth = depth !== null && depth >= 1;
  const displayedDepth = isValidSliderDepth ? depth : 1;
  const formattedDepth = displayedDepth.toFixed(1);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <label
          htmlFor="estimated-pool-depth"
          className="text-pool-950 block text-sm font-semibold"
        >
          Estimated pool depth (m)
        </label>
        <output
          htmlFor="estimated-pool-depth"
          className="text-pool-950 min-w-16 text-right text-base font-semibold"
        >
          {formattedDepth} m
        </output>
      </div>
      <input
        id="estimated-pool-depth"
        type="range"
        min="1"
        max="2"
        step="0.1"
        value={displayedDepth}
        disabled={locked}
        aria-valuetext={`${formattedDepth} m`}
        aria-invalid={!isValidSliderDepth}
        aria-describedby="estimated-pool-depth-help"
        onChange={(event) => onChange(Number(event.target.value).toFixed(1))}
        className="accent-pool-blue-800 min-h-11 w-full"
      />
      <div
        className="text-pool-600 flex justify-between text-xs"
        aria-hidden="true"
      >
        <span>Minimum 1.0 m</span>
        <span>Maximum 2.0 m</span>
      </div>
      {locked && onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="text-pool-800 ml-3 text-sm font-semibold underline"
        >
          Edit estimated depth
        </button>
      )}
      <p
        id="estimated-pool-depth-help"
        className="text-pool-600 text-xs leading-5"
      >
        2.0 m is the PoolReady modelling scope limit; deeper pools exist and
        need professional assessment.
      </p>
      {!isValidSliderDepth && (
        <p role="alert" className="text-sm text-red-700">
          Choose a depth from 1.0 m to 2.0 m.
        </p>
      )}
      {depth !== null && depth > 1.8 && (
        <p className="text-sm font-semibold text-amber-800">
          Specialist depth — professional confirmation required
        </p>
      )}
    </div>
  );
}
