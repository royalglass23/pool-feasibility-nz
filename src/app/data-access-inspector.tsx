"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { PoolScenarioComparisonResult } from "@/components/pool-scenario-comparison-result";
import { FeasibilityAssessmentResult } from "@/components/feasibility-assessment-result";
import {
  poolLocationOptions,
  poolScenarioCatalogue,
  type PreferredPoolLocation,
  type PoolScenarioId,
} from "@/config/pool-scenarios";
import type { DataAccessSpikeResult } from "@/modules/data-access-spike/run-data-access-spike";
import { PropertyAerialMap } from "@/components/map/property-aerial-map";

type ApiResponse =
  | { data: DataAccessSpikeResult }
  | {
      error: {
        code: string;
        message: string;
        options?: Array<{ addressId: string; fullAddress: string }>;
      };
    };

export function DataAccessInspector() {
  const [address, setAddress] = useState("");
  const [preferredSize, setPreferredSize] = useState<PoolScenarioId | "">("");
  const [preferredLocation, setPreferredLocation] =
    useState<PreferredPoolLocation>("any");
  const [result, setResult] = useState<DataAccessSpikeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addressOptions, setAddressOptions] = useState<
    Array<{ addressId: string; fullAddress: string }>
  >([]);
  const [canRetry, setCanRetry] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;

    await requestPropertyData();
  }

  async function requestPropertyData(selectedAddressId?: string) {
    if (isLoading) return;

    const requestedAddress = address.trim();
    if (requestedAddress.length < 8) {
      setError("Enter a complete Auckland property address.");
      setCanRetry(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setCanRetry(false);
    setResult(null);
    setAddressOptions([]);

    try {
      const response = await fetch("/api/internal/data-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: requestedAddress,
          ...(selectedAddressId ? { selectedAddressId } : {}),
          ...(preferredLocation === "any" ? {} : { preferredLocation }),
          ...(preferredSize ? { preferredSize } : {}),
        }),
      });
      const body = (await response.json()) as ApiResponse;

      if (!response.ok || "error" in body) {
        if (
          "error" in body &&
          body.error.code === "ADDRESS_AMBIGUOUS" &&
          body.error.options?.length
        ) {
          setAddressOptions(body.error.options);
        } else {
          setError(
            "error" in body
              ? body.error.message
              : "The data request could not be completed.",
          );
          setCanRetry(
            "error" in body && body.error.code === "DATA_PROVIDER_ERROR",
          );
        }
        return;
      }

      setResult(body.data);
      setCanRetry(false);
    } catch {
      setError(
        "The data service could not be reached. Check the local server and try again.",
      );
      setCanRetry(true);
    } finally {
      setIsLoading(false);
    }
  }

  function downloadResult() {
    if (!result) return;

    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json",
    });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `property-data-${result.resolvedAddress.addressId}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={handleSubmit}
        className="rounded-3xl border border-white/70 bg-white p-5 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.35)] sm:p-7"
      >
        <div className="mb-4 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-teal-50 text-teal-700">
            <MapPin className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold text-slate-950">Property address</h2>
            <p className="text-sm text-slate-500">
              Auckland addresses only for this proof of concept.
            </p>
          </div>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Preferred pool size
            <select
              value={preferredSize}
              onChange={(event) => {
                const scenario = poolScenarioCatalogue.scenarios.find(
                  (item) => item.id === event.target.value,
                );
                setPreferredSize(scenario?.id ?? "");
              }}
              className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 font-normal text-slate-950 outline-none focus:border-teal-600 focus:bg-white focus:ring-4 focus:ring-teal-600/10"
            >
              <option value="">No preference</option>
              {poolScenarioCatalogue.scenarios.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.label} - {scenario.shell.lengthMetres}m x{" "}
                  {scenario.shell.widthMetres}m
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Preferred pool location
            <select
              value={preferredLocation}
              onChange={(event) => {
                const location = poolLocationOptions.find(
                  (item) => item.id === event.target.value,
                );
                setPreferredLocation(location?.id ?? "any");
              }}
              className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 font-normal text-slate-950 outline-none focus:border-teal-600 focus:bg-white focus:ring-4 focus:ring-teal-600/10"
            >
              {poolLocationOptions.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label htmlFor="property-address" className="sr-only">
          Auckland property address
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="property-address"
            name="address"
            value={address}
            onChange={(event) => {
              setAddress(event.target.value);
              setAddressOptions([]);
            }}
            required
            minLength={8}
            maxLength={200}
            autoComplete="street-address"
            placeholder="e.g. 42A Bahari Drive, Ranui, Auckland"
            className="min-h-13 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base text-slate-950 transition outline-none placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:ring-4 focus:ring-teal-600/10"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 font-semibold text-white transition hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isLoading ? (
              <LoaderCircle
                className="size-5 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Search className="size-5" aria-hidden="true" />
            )}
            {isLoading ? "Fetching official data…" : "Fetch property data"}
          </button>
        </div>

        <div className="mt-4 min-h-6" aria-live="polite">
          {isLoading && (
            <div className="rounded-2xl border border-teal-100 bg-teal-50/70 p-4">
              <p className="text-sm font-medium text-teal-950">
                Checking official property data. This may take several seconds.
              </p>
              <ol className="mt-3 grid gap-2 text-sm text-teal-900 sm:grid-cols-3">
                <li>1. Resolving address</li>
                <li>2. Confirming legal parcel</li>
                <li>3. Loading aerial imagery</li>
              </ol>
            </div>
          )}
          {error && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-2 text-sm font-medium text-red-700">
                <AlertTriangle
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                {error}
              </p>
              {canRetry && (
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => void requestPropertyData()}
                  className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-800 transition hover:border-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw className="size-4" aria-hidden="true" />
                  Try again
                </button>
              )}
            </div>
          )}
        </div>

        {addressOptions.length > 0 && (
          <section
            aria-labelledby="address-options-heading"
            className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"
          >
            <h3
              id="address-options-heading"
              className="font-semibold text-amber-950"
            >
              Select the correct address
            </h3>
            <p className="mt-1 text-sm text-amber-800">
              More than one Auckland address matched. Choose one before its
              legal parcel is loaded.
            </p>
            <div className="mt-3 grid gap-2">
              {addressOptions.map((option) => (
                <button
                  key={option.addressId}
                  type="button"
                  disabled={isLoading}
                  onClick={() => void requestPropertyData(option.addressId)}
                  className="rounded-xl border border-amber-300 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-900 transition hover:border-teal-600 hover:text-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {option.fullAddress}
                </button>
              ))}
            </div>
          </section>
        )}
      </form>

      {result && (
        <PropertyDataResult
          result={result}
          onDownload={downloadResult}
          onRetry={() => void requestPropertyData()}
        />
      )}
    </div>
  );
}

function PropertyDataResult({
  result,
  onDownload,
  onRetry,
}: {
  result: DataAccessSpikeResult;
  onDownload: () => void;
  onRetry: () => void;
}) {
  const datasets = Object.entries(result.datasets);
  const successfulCount = datasets.filter(
    ([, dataset]) => dataset.status === "success",
  ).length;
  const unavailableCount = datasets.filter(
    ([, dataset]) => dataset.status === "unavailable",
  ).length;

  return (
    <section aria-labelledby="result-heading" className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold tracking-[0.18em] text-teal-700 uppercase">
            Official data result
          </p>
          <h2
            id="result-heading"
            className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl"
          >
            {result.resolvedAddress.fullAddress}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Retrieved {formatDate(result.generatedAt)} · LINZ address ID{" "}
            {result.resolvedAddress.addressId}
          </p>
        </div>
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 font-semibold text-slate-800 shadow-sm transition hover:border-teal-600 hover:text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          <Download className="size-4" aria-hidden="true" />
          Download JSON
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          icon={<MapPin className="size-5" aria-hidden="true" />}
          label="Legal parcel"
          value={result.parcel.appellation || result.parcel.parcelId}
          detail={`Parcel ${result.parcel.parcelId}`}
        />
        <SummaryCard
          icon={<Database className="size-5" aria-hidden="true" />}
          label="Datasets retrieved"
          value={`${successfulCount} successful`}
          detail={`${unavailableCount} unavailable · ${result.providerErrors.length} errors`}
        />
        <SummaryCard
          icon={<ShieldCheck className="size-5" aria-hidden="true" />}
          label="Parcel match"
          value={humanize(result.parcelMatch.status)}
          detail={
            result.identityCheck.distinctFromAlternatives
              ? "Separated from returned alternatives"
              : "Alternative address shares this parcel"
          }
        />
      </div>

      <PropertyAerialMap result={result} onRetry={onRetry} />

      <PoolScenarioComparisonResult comparison={result.scenarioComparison} />
      <FeasibilityAssessmentResult assessment={result.feasibilityAssessment} />

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.6fr]">
        <div className="space-y-6">
          <ResultPanel title="Property details">
            <DescriptionList
              items={[
                ["Parcel ID", result.parcel.parcelId],
                ["Appellation", result.parcel.appellation || "Not supplied"],
                ["Parcel intent", result.parcel.parcelIntent],
                ["Titles", result.parcel.titles.join(", ") || "Not supplied"],
                [
                  "Calculated area",
                  formatArea(result.parcel.calculatedAreaSquareMetres),
                ],
                [
                  "Coordinates",
                  `${result.resolvedAddress.coordinates[1].toFixed(7)}, ${result.resolvedAddress.coordinates[0].toFixed(7)}`,
                ],
              ]}
            />
          </ResultPanel>

          <ResultPanel title="Identity checks">
            <ul className="space-y-3 text-sm text-slate-700">
              <CheckItem
                passed={result.identityCheck.exactAddressMatched}
                text="Exact supplied address matched"
              />
              <CheckItem
                passed={result.identityCheck.distinctFromAlternatives}
                text="Selected parcel separated from returned alternatives"
              />
              <CheckItem
                passed={result.parcelMatch.status === "mapped_primary_parcel"}
                text={humanize(result.parcelMatch.status)}
              />
            </ul>
            {result.parcelMatch.reasons.length > 0 && (
              <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-amber-800">
                {result.parcelMatch.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            )}
          </ResultPanel>
        </div>

        <ResultPanel title="Dataset availability">
          <div className="overflow-x-auto">
            <table className="w-full min-w-170 border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs tracking-wide text-slate-500 uppercase">
                  <th className="border-b border-slate-200 px-3 py-3 font-semibold">
                    Dataset
                  </th>
                  <th className="border-b border-slate-200 px-3 py-3 font-semibold">
                    Provider
                  </th>
                  <th className="border-b border-slate-200 px-3 py-3 font-semibold">
                    Status
                  </th>
                  <th className="border-b border-slate-200 px-3 py-3 font-semibold">
                    Features
                  </th>
                  <th className="border-b border-slate-200 px-3 py-3 font-semibold">
                    Evidence use
                  </th>
                </tr>
              </thead>
              <tbody>
                {datasets.map(([key, dataset]) => (
                  <tr key={key} className="align-top">
                    <td className="border-b border-slate-100 px-3 py-3.5">
                      <p className="font-medium text-slate-900">
                        {dataset.dataset}
                      </p>
                      {(dataset.reason || dataset.errorCode) && (
                        <p className="mt-1 max-w-80 text-xs leading-5 text-slate-500">
                          {dataset.reason ?? dataset.errorCode}
                        </p>
                      )}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3.5 text-slate-600">
                      {dataset.provider}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3.5">
                      <StatusBadge status={dataset.status} />
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3.5 text-slate-600 tabular-nums">
                      {dataset.featureCount ?? "—"}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3.5 text-slate-600">
                      {humanize(dataset.evidenceUse)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ResultPanel>
      </div>

      {result.blockers.length > 0 && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <div className="flex items-center gap-3">
            <AlertTriangle
              className="size-5 text-amber-700"
              aria-hidden="true"
            />
            <h3 className="font-semibold text-amber-950">
              Limitations and blockers
            </h3>
          </div>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-amber-900">
            {result.blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
        {icon}
      </div>
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
        {label}
      </p>
      <p className="mt-2 font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{detail}</p>
    </div>
  );
}

function ResultPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h3 className="mb-5 font-semibold text-slate-950">{title}</h3>
      {children}
    </div>
  );
}

function DescriptionList({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="divide-y divide-slate-100">
      {items.map(([label, value]) => (
        <div key={label} className="grid gap-1 py-3 first:pt-0 sm:grid-cols-2">
          <dt className="text-sm text-slate-500">{label}</dt>
          <dd className="text-sm font-medium break-words text-slate-800 sm:text-right">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function CheckItem({ passed, text }: { passed: boolean; text: string }) {
  return (
    <li className="flex items-start gap-2.5">
      {passed ? (
        <CheckCircle2
          className="mt-0.5 size-4 shrink-0 text-teal-700"
          aria-hidden="true"
        />
      ) : (
        <AlertTriangle
          className="mt-0.5 size-4 shrink-0 text-amber-700"
          aria-hidden="true"
        />
      )}
      {text}
    </li>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "success"
      ? "bg-teal-50 text-teal-800 ring-teal-600/20"
      : status === "error"
        ? "bg-red-50 text-red-800 ring-red-600/20"
        : "bg-slate-100 text-slate-700 ring-slate-500/20";

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${className}`}
    >
      {humanize(status)}
    </span>
  );
}

function humanize(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatArea(value: number | null): string {
  return value === null
    ? "Not supplied"
    : `${value.toLocaleString("en-NZ")} m²`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-NZ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
