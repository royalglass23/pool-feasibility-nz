"use client";

import Image from "next/image";
import type { SavedPreliminaryReport } from "@/modules/reporting/preliminary-report";
import {
  reportMapLegend,
  reportPoolShellClearances,
  type ReportMapLegendEntry,
} from "@/modules/reporting/preliminary-report-presentation";
import { POOL_SHELL_CLEARANCE_LIMITATION } from "@/modules/reporting/preliminary-feasibility-copy";

export function SavedReportInteractiveMap({
  report,
  attribution,
}: {
  report: SavedPreliminaryReport;
  attribution: string;
}) {
  const { entries } = reportMapLegend(report);
  const clearances = reportPoolShellClearances(report);
  const isFastPropertyViewCapture =
    report.mapImageSource === "fast_property_view_capture";

  return (
    <div
      className="border-pool-200 mt-4 overflow-hidden rounded-xl border bg-white"
      role="region"
      aria-label="Saved assessment map"
    >
      <div className="grid items-start lg:grid-cols-[minmax(0,1fr)_18rem]">
        <figure className="bg-pool-900 min-w-0">
          <div className="aspect-[3/2]">
            <Image
              src={report.mapImageDataUrl}
              alt="Saved aerial assessment map showing the mapped property and proposed pool"
              width={900}
              height={600}
              unoptimized
              className="h-full w-full object-cover"
            />
          </div>
          <figcaption className="bg-pool-950 text-pool-200 border-t border-white/15 px-4 py-3 text-xs leading-5">
            {isFastPropertyViewCapture
              ? "Saved Fast Property View capture. This is the aerial map and layer selection used when this report was generated."
              : "Saved assessment map. This is the map capture used when this report was generated."}
          </figcaption>
        </figure>
        <aside
          aria-label="Saved map layers"
          className="border-pool-200 border-t bg-white p-4 lg:border-t-0 lg:border-l"
        >
          <h4 className="text-pool-950 font-semibold">Captured map layers</h4>
          <p className="text-pool-600 mt-1 text-xs leading-5">
            This legend records what the saved image shows. It does not load or
            change live data.
          </p>
          {clearances.length === 4 && (
            <section
              role="region"
              aria-label="Saved pool-shell clearances"
              className="border-pool-200 mt-4 border-t pt-4"
            >
              <h4 className="text-pool-950 font-semibold">
                Pool-shell clearances
              </h4>
              <ul className="text-pool-800 mt-2 grid grid-cols-2 gap-2 text-xs font-semibold">
                {clearances.map((clearance, index) => (
                  <li key={clearance.id}>
                    Side {index + 1}: {clearance.label}
                  </li>
                ))}
              </ul>
              <p className="text-pool-600 mt-2 text-xs leading-5">
                {POOL_SHELL_CLEARANCE_LIMITATION}
              </p>
            </section>
          )}
          <ul className="divide-pool-100 mt-4 divide-y">
            {entries.map((entry) => (
              <SavedLayerLegend key={entry.id} entry={entry} />
            ))}
          </ul>
        </aside>
      </div>
      <p className="border-pool-200 text-pool-600 border-t px-4 py-3 text-xs leading-5 sm:px-5">
        {attribution}
      </p>
    </div>
  );
}

function SavedLayerLegend({ entry }: { entry: ReportMapLegendEntry }) {
  const status = entry.statusLabel ?? "Included in saved capture";
  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <span
        aria-hidden="true"
        className={
          entry.kind === "area"
            ? "mt-1 h-3 w-7 shrink-0 border-2"
            : "mt-2 w-7 shrink-0 border-t-[3px]"
        }
        style={
          entry.kind === "area"
            ? {
                backgroundColor: `${entry.colour}33`,
                borderColor: entry.colour,
              }
            : {
                borderTopColor: entry.colour,
                borderTopStyle: entry.dashed ? "dashed" : "solid",
              }
        }
      />
      <span className="min-w-0 text-sm">
        <span className="text-pool-900 block font-semibold">{entry.label}</span>
        <span className="text-pool-600 mt-0.5 block text-xs leading-5">
          {status}
        </span>
      </span>
    </li>
  );
}
