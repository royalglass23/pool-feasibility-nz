"use client";

import type { ReportAudience } from "@/modules/assessment/report-audience";

const pathwayOptions: {
  value: ReportAudience;
  label: string;
  description: string;
}[] = [
  {
    value: "homeowner",
    label: "My property",
    description: "I’m exploring a pool for my own property.",
  },
  {
    value: "pool_builder",
    label: "A customer property",
    description: "I’m a pool builder checking a property for a customer.",
  },
];

export function ReportAudiencePathway({
  value,
  onChange,
}: {
  value: ReportAudience | null;
  onChange: (value: ReportAudience) => void;
}) {
  return (
    <fieldset
      role="radiogroup"
      className="border-pool-200 rounded-xl border bg-white p-4 sm:p-5"
    >
      <legend className="text-pool-950 px-1 font-semibold">
        Who are you checking this property for?
      </legend>
      <p className="text-pool-600 mt-1 text-sm leading-6">
        Choose one to continue. You can switch before saving your report.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {pathwayOptions.map((option) => (
          <label
            key={option.value}
            className="border-pool-200 has-checked:border-pool-blue-700 has-checked:bg-pool-blue-50 focus-within:outline-pool-blue-700 grid cursor-pointer grid-cols-[auto_1fr] gap-x-3 rounded-lg border p-3 transition focus-within:outline-2 focus-within:outline-offset-2"
          >
            <input
              type="radio"
              name="report-audience-pathway"
              value={option.value}
              aria-label={option.label}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="border-pool-400 text-pool-blue-700 focus:ring-pool-blue-700 mt-1 size-4"
            />
            <span>
              <span className="text-pool-950 block text-sm font-semibold">
                {option.label}
              </span>
              <span className="text-pool-600 mt-0.5 block text-xs leading-5">
                {option.description}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
