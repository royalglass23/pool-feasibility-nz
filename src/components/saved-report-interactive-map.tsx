"use client";

import Image from "next/image";
import type { SavedPreliminaryReport } from "@/modules/reporting/preliminary-report";
import {
  reportMapLegend,
  reportPoolShellClearances,
  type ReportMapLegendEntry,
} from "@/modules/reporting/preliminary-report-presentation";
import { POOL_SHELL_CLEARANCE_LIMITATION } from "@/modules/reporting/preliminary-feasibility-copy";

const SERVICE_LAYER_IDS = new Set([
  "public_stormwater_assets",
  "wastewater_assets",
  "public_water_assets",
  "electricity_feeder_lines",
  "gas_distribution_lines",
]);

export function SavedReportInteractiveMap({
  report,
}: {
  report: SavedPreliminaryReport;
}) {
  const { entries } = reportMapLegend(report);
  const clearances = reportPoolShellClearances(report);
  const isFastPropertyViewCapture =
    report.mapImageSource === "fast_property_view_capture";
  const serviceEntries = entries.filter((entry) =>
    SERVICE_LAYER_IDS.has(entry.id),
  );
  const contourEntry = entries.find((entry) => entry.id === "contours");
  const overlayEntries = entries.filter(
    (entry) => entry.id !== "contours" && !SERVICE_LAYER_IDS.has(entry.id),
  );

  return (
    <div
      className="border-pool-200 mt-4 overflow-hidden rounded-xl border bg-white"
      role="region"
      aria-label="Saved assessment map"
    >
      <div className="grid items-start">
        <figure className="bg-pool-900 min-w-0">
          <Image
            src={report.mapImageDataUrl}
            alt="Saved aerial assessment map showing the mapped property and proposed pool"
            width={900}
            height={600}
            unoptimized
            className="h-auto w-full object-contain"
          />
          <figcaption className="bg-pool-950 text-pool-200 border-t border-white/15 px-4 py-3 text-xs leading-5">
            {isFastPropertyViewCapture
              ? "Saved Fast Property View capture. This is the aerial map and layer selection used when this report was generated."
              : "Saved assessment map. This is the map capture used when this report was generated."}
          </figcaption>
        </figure>
        <aside
          aria-label="Saved map layers"
          className="border-pool-200 border-t bg-white"
        >
          <header className="px-4 py-3 sm:px-5">
            <h4 className="text-pool-950 font-semibold">Map layers</h4>
            <p className="text-pool-600 mt-0.5 text-sm">
              Captured clearances, overlays, contours and mapped services
            </p>
          </header>
          <div className="border-pool-200 grid border-y md:grid-cols-3">
            <section
              role="region"
              aria-label="Saved pool-shell clearances"
              className="border-pool-200 p-4 sm:p-5 md:border-r"
            >
              <div className="flex items-center gap-3">
                <StaticLayerStatus shown={clearances.length === 4} />
                <h5 className="text-pool-950 font-semibold">
                  Pool-shell clearances
                </h5>
              </div>
              {clearances.length === 4 ? (
                <>
                  <ul className="text-pool-800 mt-2 grid grid-cols-2 gap-x-4 gap-y-1 pl-9 text-xs font-semibold">
                    {clearances.map((clearance, index) => (
                      <li key={clearance.id}>
                        Side {index + 1}: {clearance.label}
                      </li>
                    ))}
                  </ul>
                  <p className="text-pool-600 mt-2 pl-9 text-xs leading-5">
                    {POOL_SHELL_CLEARANCE_LIMITATION}
                  </p>
                </>
              ) : (
                <p className="text-pool-600 mt-1 text-xs leading-5">
                  {report.pool.clearancesVisible
                    ? "Measurements unavailable"
                    : "Not shown in saved capture"}
                </p>
              )}
            </section>
            <section
              role="region"
              aria-label="Saved assessment overlays"
              className="border-pool-200 border-t p-4 sm:p-5 md:border-t-0 md:border-r"
            >
              <div className="flex items-center gap-3">
                <StaticLayerStatus shown={overlayEntries.length > 0} />
                <h5 className="text-pool-950 font-semibold">
                  Assessment overlays
                </h5>
              </div>
              <ul className="mt-2 grid gap-2">
                {overlayEntries.map((entry) => (
                  <SavedLayerLegend key={entry.id} entry={entry} compact />
                ))}
              </ul>
            </section>
            <section
              role="region"
              aria-label="Saved contours"
              className="border-pool-200 border-t p-4 sm:p-5 md:border-t-0"
            >
              <div className="flex items-center gap-3">
                <StaticLayerStatus
                  shown={contourEntry?.statusLabel === "Mapped"}
                />
                <h5 className="text-pool-950 font-semibold">Contours</h5>
              </div>
              {contourEntry ? (
                <ul className="mt-2">
                  <SavedLayerLegend entry={contourEntry} compact />
                </ul>
              ) : (
                <p className="text-pool-600 mt-1 text-xs leading-5">
                  No mapped evidence
                </p>
              )}
            </section>
          </div>
          <section className="p-4 sm:p-5" aria-labelledby="mapped-services">
            <h5 id="mapped-services" className="text-pool-950 font-semibold">
              Mapped services
            </h5>
            <ul
              aria-label="Saved mapped services"
              className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5"
            >
              {serviceEntries.map((entry) => (
                <li
                  key={entry.id}
                  className="border-pool-200 bg-pool-50 min-w-0 rounded-sm border p-3"
                >
                  <div className="flex items-center gap-2">
                    <StaticLayerStatus shown={entry.statusLabel === "Mapped"} />
                    <LayerSwatch entry={entry} />
                    <span className="text-pool-900 min-w-0 text-sm font-semibold">
                      {entry.label}
                    </span>
                  </div>
                  <p className="text-pool-600 mt-1 pl-9 text-xs leading-5">
                    {entry.statusLabel ?? "Included in saved capture"}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

function SavedLayerLegend({
  entry,
  compact = false,
}: {
  entry: ReportMapLegendEntry;
  compact?: boolean;
}) {
  const status = entry.statusLabel ?? "Included in saved capture";
  return (
    <li className="flex gap-3">
      <LayerSwatch entry={entry} />
      <span className="min-w-0 text-sm">
        <span className="text-pool-900 block font-semibold">{entry.label}</span>
        {!compact || entry.statusLabel ? (
          <span className="text-pool-600 mt-0.5 block text-xs leading-5">
            {status}
          </span>
        ) : null}
      </span>
    </li>
  );
}

function LayerSwatch({ entry }: { entry: ReportMapLegendEntry }) {
  return (
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
  );
}

function StaticLayerStatus({ shown }: { shown: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid size-5 shrink-0 place-items-center rounded-sm border ${
        shown
          ? "border-pool-950 bg-pool-950 text-white"
          : "border-pool-300 bg-white"
      }`}
    >
      {shown ? (
        <svg viewBox="0 0 20 20" className="size-4" fill="none">
          <path
            d="m5 10 3 3 7-7"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </span>
  );
}
