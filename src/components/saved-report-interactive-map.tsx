"use client";

import Image from "next/image";
import type { SavedPreliminaryReport } from "@/modules/reporting/preliminary-report";
import {
  reportMapLegend,
  type ReportMapLegendEntry,
} from "@/modules/reporting/preliminary-report-presentation";

export function SavedReportInteractiveMap({
  report,
  attribution,
}: {
  report: SavedPreliminaryReport;
  attribution: string;
}) {
  const { entries } = reportMapLegend(report);
  const isFastPropertyViewCapture =
    report.mapImageSource === "fast_property_view_capture";

  return (
    <div
      className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white"
      role="region"
      aria-label="Saved assessment map"
    >
      <div className="grid lg:grid-cols-[minmax(0,1fr)_18rem]">
        <figure className="min-w-0 bg-slate-900">
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
          <figcaption className="border-t border-white/15 bg-slate-950 px-4 py-3 text-xs leading-5 text-slate-200">
            {isFastPropertyViewCapture
              ? "Saved Fast Property View capture. This is the aerial map and layer selection used when this report was generated."
              : "Saved assessment map. This is the map capture used when this report was generated."}
          </figcaption>
        </figure>
        <aside
          aria-label="Saved map layers"
          className="border-t border-slate-200 bg-white p-4 lg:border-t-0 lg:border-l"
        >
          <h4 className="font-semibold text-slate-950">Captured map layers</h4>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            This legend records what the saved image shows. It does not load or
            change live data.
          </p>
          <ul className="mt-4 divide-y divide-slate-100">
            {entries.map((entry) => (
              <SavedLayerLegend key={entry.id} entry={entry} />
            ))}
          </ul>
        </aside>
      </div>
      <p className="border-t border-slate-200 px-4 py-3 text-xs leading-5 text-slate-600 sm:px-5">
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
        <span className="block font-semibold text-slate-900">
          {entry.label}
        </span>
        <span className="mt-0.5 block text-xs leading-5 text-slate-600">
          {status}
        </span>
      </span>
    </li>
  );
}
