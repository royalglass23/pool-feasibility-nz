"use client";

import { parseEstimatedPoolDepth } from "@/modules/assessment/estimated-pool-depth";

export function EstimatedPoolDepth({
  value,
  locked,
  onChange,
}: {
  value: string;
  locked: boolean;
  onChange: (value: string) => void;
}) {
  const depth = parseEstimatedPoolDepth(value);
  const isValidSliderDepth = depth !== null && depth >= 1;
  const displayedDepth = isValidSliderDepth ? depth : 1;
  const formattedDepth = displayedDepth.toFixed(1);
  return (
    <section
      aria-labelledby="estimated-pool-depth-heading"
      aria-describedby={
        locked
          ? "estimated-pool-depth-help"
          : "estimated-pool-depth-description estimated-pool-depth-help"
      }
      className="space-y-3"
    >
      <h3
        id="estimated-pool-depth-heading"
        className="text-pool-950 text-lg font-semibold"
      >
        Estimated pool depth (m)
      </h3>
      {!locked && (
        <p
          id="estimated-pool-depth-description"
          className="text-pool-700 text-sm leading-6 lg:min-h-12"
        >
          Choose an indicative depth from 1.0–2.0 m for this preliminary
          property check.
        </p>
      )}
      {locked ? (
        <p className="text-pool-950 text-sm font-semibold">
          Selected depth: {formattedDepth} m
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <input
              id="estimated-pool-depth"
              type="range"
              aria-label="Estimated pool depth (m)"
              min="1"
              max="2"
              step="0.1"
              value={displayedDepth}
              aria-valuetext={`${formattedDepth} m`}
              aria-invalid={!isValidSliderDepth}
              aria-describedby="estimated-pool-depth-description estimated-pool-depth-help"
              onChange={(event) =>
                onChange(Number(event.target.value).toFixed(1))
              }
              className="accent-pool-blue-800 min-h-11 w-full"
            />
            <output
              htmlFor="estimated-pool-depth"
              className="text-pool-950 min-w-16 text-sm font-semibold"
            >
              {formattedDepth} m
            </output>
          </div>
          <div
            className="text-pool-600 flex justify-between text-xs"
            aria-hidden="true"
          >
            <span>Minimum 1.0 m</span>
            <span>Maximum 2.0 m</span>
          </div>
        </>
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
    </section>
  );
}
