"use client";

import Link from "next/link";
import { Download, Search } from "lucide-react";
import { useMemo, useState } from "react";
import {
  staffFeasibilityLabels,
  type StaffAssessmentSummary,
  type StaffFeasibilityState,
} from "@/modules/staff/staff-assessment-read-model";

const submittedDate = new Intl.DateTimeFormat("en-NZ", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Pacific/Auckland",
});

const pageSizeOptions = [5, 10, 20, 50] as const;
type PageSize = (typeof pageSizeOptions)[number];
type SortDirection = "ascending" | "descending";

const feasibilityClasses: Record<StaffFeasibilityState, string> = {
  no_warning: "bg-emerald-50 text-emerald-800",
  needs_checking: "bg-amber-50 text-amber-900",
  blocked: "bg-red-50 text-red-800",
};

export function StaffAssessmentDashboard({
  assessments,
}: {
  assessments: StaffAssessmentSummary[];
}) {
  const [query, setQuery] = useState("");
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("descending");
  const [pageSize, setPageSize] = useState<PageSize>(5);
  const [page, setPage] = useState(1);

  const filteredAssessments = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("en-NZ");
    return assessments
      .filter((assessment) =>
        normalizedQuery.length === 0
          ? true
          : [
              assessment.homeownerAddress,
              assessment.homeownerName,
              assessment.homeownerPhone,
            ].some((value) =>
              value.toLocaleLowerCase("en-NZ").includes(normalizedQuery),
            ),
      )
      .sort((left, right) => {
        const difference = left.createdAt.getTime() - right.createdAt.getTime();
        return sortDirection === "ascending" ? difference : -difference;
      });
  }, [assessments, query, sortDirection]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredAssessments.length / pageSize),
  );
  const currentPage = Math.min(page, totalPages);
  const firstResult =
    filteredAssessments.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastResult = Math.min(
    currentPage * pageSize,
    filteredAssessments.length,
  );
  const visibleAssessments = filteredAssessments.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  function updateQuery(value: string) {
    setQuery(value);
    setPage(1);
  }

  function updatePageSize(value: PageSize) {
    setPageSize(value);
    setPage(1);
  }

  function toggleDateSort() {
    setSortDirection((current) =>
      current === "descending" ? "ascending" : "descending",
    );
    setPage(1);
  }

  if (assessments.length === 0) {
    return (
      <section className="border-pool-200 rounded-xl border bg-white px-6 py-16 text-center shadow-sm">
        <h2
          id="staff-assessments-heading"
          className="text-pool-950 text-xl font-semibold"
        >
          No saved assessments yet
        </h2>
        <p className="text-pool-600 mx-auto mt-3 max-w-lg text-sm leading-6">
          New homeowner submissions will appear here once they are received.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="staff-assessments-heading"
      className="border-pool-200 overflow-hidden rounded-xl border bg-white shadow-sm"
    >
      <div className="border-pool-200 flex flex-col gap-4 border-b px-4 py-4 sm:px-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2
            id="staff-assessments-heading"
            className="text-pool-950 text-xl font-semibold"
          >
            Saved assessments
          </h2>
          <p className="text-pool-600 mt-1 text-sm">
            Search by homeowner, address, or phone number.
          </p>
        </div>
        <button
          className="border-pool-300 text-pool-800 hover:border-pool-blue-700 hover:text-pool-blue-900 focus-visible:outline-pool-blue-700 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border bg-white px-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={filteredAssessments.length === 0}
          onClick={() => exportAssessmentsCsv(filteredAssessments)}
          type="button"
        >
          <Download aria-hidden="true" className="size-4" />
          Export CSV
        </button>
      </div>

      <div className="border-pool-200 bg-pool-50/60 flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <label className="relative block w-full sm:max-w-md">
          <Search
            aria-hidden="true"
            className="text-pool-600 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <span className="sr-only">Search assessments</span>
          <input
            className="border-pool-300 text-pool-950 placeholder:text-pool-600 focus:border-pool-blue-700 focus:outline-pool-blue-700 min-h-10 w-full rounded-lg border bg-white py-2 pr-3 pl-10 text-sm outline-offset-2 focus:outline-2"
            onChange={(event) => updateQuery(event.target.value)}
            placeholder="Search name, address, or phone"
            type="search"
            value={query}
          />
        </label>
        <label className="text-pool-700 flex items-center gap-2 text-sm font-medium">
          Rows per page
          <select
            aria-label="Rows per page"
            className="border-pool-300 text-pool-950 focus:border-pool-blue-700 focus:outline-pool-blue-700 min-h-10 rounded-lg border bg-white px-2 text-sm outline-offset-2 focus:outline-2"
            onChange={(event) =>
              updatePageSize(Number(event.target.value) as PageSize)
            }
            value={pageSize}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[54rem] border-collapse text-left text-sm">
          <thead className="bg-pool-50 text-pool-700 text-xs font-semibold tracking-wide uppercase">
            <tr>
              <th className="px-4 py-3 sm:px-5" scope="col">
                Homeowner
              </th>
              <th className="px-4 py-3" scope="col">
                Address
              </th>
              <th className="px-4 py-3" scope="col">
                Phone
              </th>
              <th aria-sort={sortDirection} className="px-4 py-3" scope="col">
                <button
                  aria-label={`Sort by date submitted ${sortDirection === "descending" ? "oldest first" : "newest first"}`}
                  className="hover:text-pool-blue-900 focus-visible:outline-pool-blue-700 inline-flex items-center gap-1 rounded text-left focus-visible:outline-2 focus-visible:outline-offset-2"
                  onClick={toggleDateSort}
                  type="button"
                >
                  Date submitted
                  <span aria-hidden="true">
                    {sortDirection === "descending" ? "↓" : "↑"}
                  </span>
                </button>
              </th>
              <th className="px-4 py-3" scope="col">
                Status
              </th>
              <th className="px-4 py-3 text-right sm:px-5" scope="col">
                <span className="sr-only">Open assessment</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-pool-200 divide-y">
            {visibleAssessments.map((assessment) => (
              <tr key={assessment.id} className="hover:bg-pool-50/70">
                <td className="text-pool-950 px-4 py-3 align-top font-medium sm:px-5">
                  <p>{assessment.homeownerName}</p>
                  <p className="text-pool-600 mt-0.5 font-mono text-xs font-medium">
                    {assessment.reference}
                  </p>
                </td>
                <td className="text-pool-700 max-w-xs px-4 py-3 align-top">
                  {assessment.homeownerAddress}
                </td>
                <td className="text-pool-700 px-4 py-3 align-top whitespace-nowrap">
                  {assessment.homeownerPhone}
                </td>
                <td className="text-pool-700 px-4 py-3 align-top whitespace-nowrap">
                  <time dateTime={assessment.createdAt.toISOString()}>
                    {submittedDate.format(assessment.createdAt)}
                  </time>
                </td>
                <td className="px-4 py-3 align-top">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${feasibilityClasses[assessment.feasibilityState]}`}
                  >
                    {staffFeasibilityLabels[assessment.feasibilityState]}
                  </span>
                </td>
                <td className="px-4 py-3 text-right align-top sm:px-5">
                  <Link
                    aria-label={`Open ${assessment.reference}`}
                    className="text-pool-blue-800 hover:bg-pool-blue-50 hover:text-pool-blue-950 focus-visible:outline-pool-blue-700 inline-flex min-h-9 items-center rounded-lg px-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2"
                    href={`/staff/${assessment.id}`}
                    prefetch={false}
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredAssessments.length === 0 ? (
        <p className="text-pool-600 px-4 py-10 text-center text-sm sm:px-5">
          No saved assessments match that search.
        </p>
      ) : null}

      <div className="border-pool-200 text-pool-600 flex flex-col gap-3 border-t px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p>
          Showing {firstResult}–{lastResult} of {filteredAssessments.length}
        </p>
        <nav aria-label="Assessment pages" className="flex items-center gap-2">
          <button
            className="border-pool-300 text-pool-800 hover:border-pool-blue-700 hover:text-pool-blue-900 focus-visible:outline-pool-blue-700 min-h-9 rounded-lg border bg-white px-3 font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={currentPage === 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            type="button"
          >
            Previous
          </button>
          <span aria-live="polite">
            Page {currentPage} of {totalPages}
          </span>
          <button
            className="border-pool-300 text-pool-800 hover:border-pool-blue-700 hover:text-pool-blue-900 focus-visible:outline-pool-blue-700 min-h-9 rounded-lg border bg-white px-3 font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={currentPage === totalPages}
            onClick={() =>
              setPage((current) => Math.min(totalPages, current + 1))
            }
            type="button"
          >
            Next
          </button>
        </nav>
      </div>
    </section>
  );
}

function exportAssessmentsCsv(assessments: StaffAssessmentSummary[]) {
  const rows = assessments.map((assessment) => [
    assessment.reference,
    assessment.homeownerName,
    assessment.homeownerAddress,
    assessment.homeownerPhone,
    submittedDate.format(assessment.createdAt),
    staffFeasibilityLabels[assessment.feasibilityState],
  ]);
  const csv = [
    ["Reference", "Name", "Address", "Phone", "Date submitted", "Status"],
    ...rows,
  ]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "saved-assessments.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: string) {
  const spreadsheetSafeValue = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${spreadsheetSafeValue.replaceAll('"', '""')}"`;
}
