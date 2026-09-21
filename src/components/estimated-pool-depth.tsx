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
  return (
    <div className="border-pool-200 space-y-2 border-t pt-4">
      <label
        htmlFor="estimated-pool-depth"
        className="text-pool-950 block text-sm font-semibold"
      >
        Estimated pool depth (m)
      </label>
      <input
        id="estimated-pool-depth"
        type="number"
        inputMode="decimal"
        max="2"
        step="any"
        value={value}
        disabled={locked}
        aria-invalid={depth === null}
        aria-describedby="estimated-pool-depth-help"
        onChange={(event) => onChange(event.target.value)}
        className="border-pool-300 focus-visible:outline-pool-blue-700 h-11 w-32 rounded-sm border px-3 text-sm focus-visible:outline-2"
      />
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
      {depth === null && (
        <p role="alert" className="text-sm text-red-700">
          Enter a depth greater than 0 and no more than 2.0 m.
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
