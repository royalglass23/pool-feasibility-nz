"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  LoaderCircle,
  MapPin,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { PoolScenarioComparisonResult } from "@/components/pool-scenario-comparison-result";
import { FeasibilityAssessmentResult } from "@/components/feasibility-assessment-result";
import { SessionAssessmentResult } from "@/components/session-assessment-result";
import { AssessmentExplanationResult } from "@/components/assessment-explanation-result";
import { AssessmentWorkspace } from "@/components/assessment-workspace";
import type { DataAccessSpikeResult } from "@/modules/data-access-spike/run-data-access-spike";
import type { AddressMatch } from "@/modules/data-access-spike/data-access-gateway";
import type { DataAccessRequestError } from "@/modules/data-access-spike/execute-data-access-request";
import { buildSessionAssessment } from "@/modules/assessment/build-session-assessment";
import type { AssessmentExplanation } from "@/modules/recommendations/generate-assessment-explanation";
import { PropertyAerialMap } from "@/components/map/property-aerial-map";
import { humanizeIdentifierTitleCase as humanize } from "@/shared/text/humanize-identifier";
import {
  FastPropertyView,
  type FastPropertyViewMapSnapshot,
} from "@/components/fast-property-view";
import { HomeownerSubmissionForm } from "@/components/homeowner-submission-form";
import { ActionProgressDialog } from "@/components/action-progress-dialog";
import {
  SavedAssessmentReportPanel,
  useSavedAssessmentReport,
} from "@/components/saved-assessment-report-panel";
import type { FastPropertyViewResult } from "@/modules/data-access-spike/fast-property-view";
import type { FastPropertyViewRequestError } from "@/modules/data-access-spike/execute-fast-property-view-request";
import type { FastPropertyDetails } from "@/modules/data-access-spike/execute-fast-property-details";
import type { FastPoolPlacementSnapshot } from "@/modules/data-access-spike/fast-pool-warning";
import { trackAnonymousFunnelEvent } from "@/modules/anonymous-funnel-analytics";

type DataAccessApiResult = DataAccessSpikeResult & {
  assessmentExplanation?: AssessmentExplanation;
  reportToken: string;
};

type FastApiResponse =
  | { data: FastPropertyViewResult; assessmentSnapshot: string }
  | { error: FastPropertyViewRequestError };

type ApiResponse =
  | {
      data: Omit<DataAccessApiResult, "reportToken">;
      reportToken: string;
    }
  | {
      error: DataAccessRequestError;
    };

type AddressOption = Pick<AddressMatch, "addressId" | "fullAddress">;
type PendingSelectedAddress = AddressOption;

export function DataAccessInspector() {
  const [address, setAddress] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    null,
  );
  const [result, setResult] = useState<DataAccessApiResult | null>(null);
  const [fastResult, setFastResult] = useState<FastPropertyViewResult | null>(
    null,
  );
  const [pendingSelectedAddress, setPendingSelectedAddress] =
    useState<PendingSelectedAddress | null>(null);
  const [fastAssessmentSnapshot, setFastAssessmentSnapshot] = useState<
    string | null
  >(null);
  const [fastPlacementSnapshot, setFastPlacementSnapshot] =
    useState<FastPoolPlacementSnapshot | null>(null);
  const [fastMapSnapshot, setFastMapSnapshot] =
    useState<FastPropertyViewMapSnapshot | null>(null);
  const fastSavedReport = useSavedAssessmentReport();
  const [error, setError] = useState<string | null>(null);
  const [addressOptions, setAddressOptions] = useState<AddressOption[]>([]);
  const [canRetry, setCanRetry] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isLoadingDetailed, setIsLoadingDetailed] = useState(false);
  const detailedRequestInFlightRef = useRef(false);
  const fastRequestIdRef = useRef(0);
  const [suggestionMessage, setSuggestionMessage] = useState<string | null>(
    null,
  );
  const isEnteringAddress =
    !pendingSelectedAddress &&
    !fastResult &&
    !result &&
    !fastSavedReport.assessment;
  const handleFastPlacementChange = useCallback(
    (placement: FastPoolPlacementSnapshot) => {
      setFastPlacementSnapshot(placement);
      setFastMapSnapshot(null);
    },
    [],
  );

  useEffect(() => {
    const query = address.trim();
    if (query.length < 3 || selectedAddressId || result || isLoading) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsSuggesting(true);
      setSuggestionMessage(null);
      try {
        const response = await fetch("/api/public/address-suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("Address suggestions are temporarily unavailable.");
        }
        const body = (await response.json()) as {
          suggestions?: AddressOption[];
        };
        const nextSuggestions = body.suggestions ?? [];
        setAddressOptions(nextSuggestions);
        setSuggestionMessage(
          nextSuggestions.length === 0
            ? "No matching New Zealand addresses were found yet."
            : null,
        );
      } catch {
        if (!controller.signal.aborted) {
          setAddressOptions([]);
          setSuggestionMessage(
            "Address suggestions are temporarily unavailable.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setIsSuggesting(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [address, isLoading, result, selectedAddressId]);

  useEffect(() => {
    const intro = document.getElementById("property-search-intro");
    if (intro) intro.hidden = !isEnteringAddress;
  }, [isEnteringAddress]);

  function selectAddress(option: AddressOption) {
    setAddress(option.fullAddress);
    setSelectedAddressId(option.addressId);
    setPendingSelectedAddress({
      addressId: option.addressId,
      fullAddress: option.fullAddress,
    });
    setAddressOptions([]);
    void requestPropertyData(option.addressId);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;

    await requestPropertyData(
      selectedAddressId ??
        (addressOptions.length === 1 ? addressOptions[0].addressId : undefined),
    );
  }

  async function requestPropertyData(selectedId?: string) {
    if (isLoading) return;

    const requestedAddress = address.trim();
    if (requestedAddress.length < 8) {
      setError("Enter a complete New Zealand property address.");
      setCanRetry(false);
      return;
    }

    trackAnonymousFunnelEvent({ name: "address_search_started" });
    const requestId = ++fastRequestIdRef.current;
    setIsLoading(true);
    setError(null);
    setCanRetry(false);
    setResult(null);
    setFastResult(null);
    setPendingSelectedAddress((current) =>
      selectedId && current?.addressId === selectedId ? current : null,
    );
    setFastAssessmentSnapshot(null);
    setFastPlacementSnapshot(null);
    setFastMapSnapshot(null);
    fastSavedReport.resetReport();
    setAddressOptions([]);
    setSuggestionMessage(null);

    try {
      const response = await fetch("/api/public/property-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: requestedAddress,
          ...((selectedId ?? selectedAddressId)
            ? { selectedAddressId: selectedId ?? selectedAddressId }
            : {}),
        }),
      });
      const body = (await response.json()) as FastApiResponse;

      if (!response.ok || "error" in body) {
        if (
          "error" in body &&
          body.error.code === "ADDRESS_AMBIGUOUS" &&
          body.error.options?.length
        ) {
          setAddressOptions(body.error.options);
        } else {
          const responseError = "error" in body ? body.error : null;
          setError(
            responseError
              ? responseError.message
              : "The fast property view could not be completed.",
          );
          setCanRetry(
            "error" in body &&
              (body.error.code === "DATA_PROVIDER_ERROR" ||
                body.error.code === "ANALYSIS_FAILED"),
          );
        }
        return;
      }

      const legacyBody = body as unknown as ApiResponse;
      if (
        "data" in legacyBody &&
        legacyBody.data &&
        !("boundary" in legacyBody.data)
      ) {
        setResult({
          ...legacyBody.data,
          reportToken:
            "reportToken" in legacyBody &&
            typeof legacyBody.reportToken === "string"
              ? legacyBody.reportToken
              : "legacy-response",
        });
        trackAnonymousFunnelEvent({ name: "property_check_completed" });
        setCanRetry(false);
        return;
      }

      if (fastRequestIdRef.current !== requestId) return;
      setFastResult(body.data);
      setPendingSelectedAddress(null);
      setFastAssessmentSnapshot(body.assessmentSnapshot);
      trackAnonymousFunnelEvent({ name: "property_check_completed" });
      setCanRetry(false);
      void requestFastStages(body.data, body.assessmentSnapshot, requestId);
    } catch {
      setError(
        "The data service could not be reached. Check the local server and try again.",
      );
      setCanRetry(true);
    } finally {
      setIsLoading(false);
    }
  }

  async function requestFastStages(
    initial: FastPropertyViewResult,
    assessmentSnapshot: string,
    requestId: number,
  ) {
    try {
      const response = await fetch("/api/public/property-check/stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressId: initial.resolvedAddress.addressId,
          coordinates: initial.resolvedAddress.coordinates,
          assessmentSnapshot,
        }),
      });
      const body = (await response.json()) as {
        data?: Pick<
          FastPropertyViewResult,
          "boundary" | "aerial" | "datasets" | "progress" | "fastPathDurationMs"
        >;
        assessmentSnapshot?: string;
        error?: { message?: string };
      };
      if (
        !response.ok ||
        !body.data ||
        !body.assessmentSnapshot ||
        fastRequestIdRef.current !== requestId
      ) {
        if (
          !response.ok &&
          body.error?.message &&
          fastRequestIdRef.current === requestId
        ) {
          setError(body.error.message);
          setCanRetry(true);
        }
        return;
      }
      setFastResult((current) =>
        current?.resolvedAddress.addressId === initial.resolvedAddress.addressId
          ? { ...current, ...body.data }
          : current,
      );
      setFastAssessmentSnapshot(body.assessmentSnapshot);
    } catch {
      setFastResult((current) =>
        current?.resolvedAddress.addressId === initial.resolvedAddress.addressId
          ? {
              ...current,
              aerial: { ...current.aerial, state: "error" },
              progress: { ...current.progress, aerial: "error" },
            }
          : current,
      );
    }
  }

  async function requestDetailedPropertyData() {
    if (
      !fastResult ||
      !fastAssessmentSnapshot ||
      isLoadingDetailed ||
      detailedRequestInFlightRef.current
    )
      return;
    const requestId = fastRequestIdRef.current;
    detailedRequestInFlightRef.current = true;
    setIsLoadingDetailed(true);
    setFastMapSnapshot(null);
    try {
      const response = await fetch("/api/public/property-check/stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "detailed",
          addressId: fastResult.resolvedAddress.addressId,
          coordinates: fastResult.resolvedAddress.coordinates,
          assessmentSnapshot: fastAssessmentSnapshot,
        }),
      });
      const body = (await response.json()) as {
        data?: FastPropertyDetails;
        assessmentSnapshot?: string;
        error?: { message: string };
      };
      if (
        !response.ok ||
        !body.data ||
        !body.assessmentSnapshot ||
        fastRequestIdRef.current !== requestId
      ) {
        setError(
          body.error
            ? body.error.message
            : "Detailed checks could not be completed.",
        );
        return;
      }
      setFastMapSnapshot(null);
      setFastResult((current) =>
        current ? { ...current, detailedChecks: body.data } : current,
      );
      setFastAssessmentSnapshot(body.assessmentSnapshot);
      setError(null);
    } catch {
      setError(
        "The detailed data service could not be reached. The fast view remains available.",
      );
    } finally {
      detailedRequestInFlightRef.current = false;
      setIsLoadingDetailed(false);
    }
  }

  function downloadResult() {
    if (!result) return;

    const assessment = buildSessionAssessment(
      result,
      result.assessmentExplanation,
    );
    const blob = new Blob([JSON.stringify(assessment, null, 2)], {
      type: "application/json",
    });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `session-assessment-${result.resolvedAddress.addressId}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }

  function startAgain() {
    fastRequestIdRef.current += 1;
    setAddress("");
    setSelectedAddressId(null);
    setResult(null);
    setFastResult(null);
    setPendingSelectedAddress(null);
    setFastAssessmentSnapshot(null);
    setFastPlacementSnapshot(null);
    setFastMapSnapshot(null);
    setError(null);
    setCanRetry(false);
    setAddressOptions([]);
    setSuggestionMessage(null);
    fastSavedReport.resetReport();
  }

  return (
    <div className="space-y-8">
      <ActionProgressDialog
        open={isLoading && !fastResult && !pendingSelectedAddress}
        title="Fetching property data"
        description="Retrieving available property information and preparing your property view."
      />
      <ActionProgressDialog
        open={isLoadingDetailed}
        title="Running detailed official checks"
        description="Reviewing available official datasets and mapped property evidence."
      />
      {isEnteringAddress && (
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-white/70 bg-white p-5 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.35)] sm:p-7"
        >
          <div className="mb-4 flex items-center gap-3">
            <span className="bg-pool-blue-50 text-pool-blue-700 grid size-10 place-items-center rounded-2xl">
              <MapPin className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-pool-950 font-semibold">
                Your property address
              </h2>
              <p className="text-pool-500 text-sm">
                Currently available for Auckland addresses only. We will match
                your address against official data before showing the property
                view.
              </p>
            </div>
          </div>

          <label htmlFor="property-address" className="sr-only">
            Auckland property address
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <input
                id="property-address"
                name="address"
                value={address}
                onChange={(event) => {
                  setAddress(event.target.value);
                  setSelectedAddressId(null);
                  setAddressOptions([]);
                  setSuggestionMessage(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && addressOptions.length > 0) {
                    event.preventDefault();
                    selectAddress(addressOptions[0]);
                  }
                }}
                required
                minLength={8}
                maxLength={200}
                autoComplete="street-address"
                placeholder="e.g. 42A Bahari Drive, Ranui, Auckland"
                className="border-pool-200 bg-pool-50 text-pool-950 placeholder:text-pool-400 focus:border-pool-blue-600 focus:ring-pool-blue-600/10 min-h-13 w-full rounded-2xl border px-4 text-base transition outline-none focus:bg-white focus:ring-4"
                aria-autocomplete="list"
                aria-controls="address-suggestions"
              />
              {addressOptions.length > 0 && !selectedAddressId && !result && (
                <div
                  id="address-suggestions"
                  role="listbox"
                  aria-label="Address suggestions"
                  className="border-pool-200 absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border bg-white p-2 shadow-xl"
                >
                  {addressOptions.map((option) => (
                    <button
                      key={option.addressId}
                      type="button"
                      role="option"
                      aria-selected="false"
                      onClick={() => selectAddress(option)}
                      className="text-pool-900 hover:bg-pool-blue-50 hover:text-pool-blue-800 w-full rounded-xl px-3 py-3 text-left text-sm font-semibold"
                    >
                      {option.fullAddress}
                    </button>
                  ))}
                </div>
              )}
              {isSuggesting && (
                <p className="text-pool-500 mt-1 text-xs">
                  Searching LINZ addresses…
                </p>
              )}
              {!isSuggesting && suggestionMessage && !selectedAddressId && (
                <p className="text-pool-600 mt-1 text-xs" role="status">
                  {suggestionMessage}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 min-h-6" aria-live="polite">
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
        </form>
      )}

      {pendingSelectedAddress && !fastResult && !result && (
        <SelectedAddressPending
          address={pendingSelectedAddress.fullAddress}
          error={error}
          canRetry={canRetry}
          isLoading={isLoading}
          onRetry={() =>
            void requestPropertyData(pendingSelectedAddress.addressId)
          }
          onStartAgain={startAgain}
        />
      )}

      {fastResult && !result && !fastSavedReport.assessment && (
        <>
          {error && (
            <div
              role="alert"
              className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950"
            >
              <p className="font-semibold">
                We couldn&apos;t finish every property check.
              </p>
              <p className="mt-1">
                Your preliminary property view is still available. Please search
                for the address again.
              </p>
              <button
                type="button"
                onClick={startAgain}
                className="mt-3 min-h-11 font-semibold text-amber-950 underline underline-offset-2 hover:text-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-800"
              >
                Search again
              </button>
            </div>
          )}
          <FastPropertyView
            result={fastResult}
            onLoadDetailed={() => void requestDetailedPropertyData()}
            onRetry={() =>
              void requestPropertyData(fastResult.resolvedAddress.addressId)
            }
            onStartAgain={startAgain}
            isLoadingDetailed={isLoadingDetailed}
            onPlacementChange={handleFastPlacementChange}
            onSnapshotReady={setFastMapSnapshot}
          />
          {fastPlacementSnapshot?.dimensions &&
          fastPlacementSnapshot.constructionEnvelopeWithinMappedArea &&
          fastAssessmentSnapshot &&
          fastMapSnapshot &&
          fastResult.detailedChecks ? (
            <HomeownerSubmissionForm
              assessmentSnapshot={fastAssessmentSnapshot}
              mapImageDataUrl={fastMapSnapshot.imageDataUrl}
              mapVisibleLayerKeys={fastMapSnapshot.visibleLayerKeys}
              placement={fastPlacementSnapshot}
              onSaved={fastSavedReport.saveAssessment}
            />
          ) : (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-900">
              Choose a valid pool placement, load the detailed official checks,
              and wait for the map capture before saving the report.
            </p>
          )}
        </>
      )}

      {fastSavedReport.assessment && (
        <SavedAssessmentReportPanel
          assessment={fastSavedReport.assessment}
          showReport={fastSavedReport.showReport}
          onOpen={fastSavedReport.openReport}
          onBack={fastSavedReport.closeReport}
          onStartAgain={() => window.location.reload()}
        />
      )}

      {result && (
        <AssessmentWorkspace
          key={result.resolvedAddress.addressId}
          result={result}
          onDownloadData={downloadResult}
          onRetry={() => void requestDetailedPropertyData()}
        />
      )}
    </div>
  );
}

function SelectedAddressPending({
  address,
  error,
  canRetry,
  isLoading,
  onRetry,
  onStartAgain,
}: {
  address: string;
  error: string | null;
  canRetry: boolean;
  isLoading: boolean;
  onRetry: () => void;
  onStartAgain: () => void;
}) {
  return (
    <section
      aria-labelledby="selected-address-pending-heading"
      className="space-y-4 rounded-3xl border border-white/70 bg-white p-5 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.35)] sm:p-7"
    >
      <div className="flex items-start gap-3">
        <span className="bg-pool-blue-50 text-pool-blue-700 grid size-10 place-items-center rounded-2xl">
          <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
        </span>
        <div>
          <p className="text-pool-blue-700 text-xs font-bold tracking-[0.18em] uppercase">
            Address selected
          </p>
          <h2
            id="selected-address-pending-heading"
            className="text-pool-950 mt-2 text-2xl font-semibold"
          >
            Checking selected address
          </h2>
          <p className="text-pool-700 mt-2 font-semibold">{address}</p>
          <p className="text-pool-600 mt-2 text-sm leading-6">
            Checking the property boundary and available official information.
          </p>
        </div>
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
        >
          <p className="font-semibold">
            We couldn&apos;t verify a property view for this address.
          </p>
          <p className="mt-1">{error}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            {canRetry && (
              <button
                type="button"
                disabled={isLoading}
                onClick={onRetry}
                className="min-h-11 rounded-xl border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-950"
              >
                Try again
              </button>
            )}
            <button
              type="button"
              onClick={onStartAgain}
              className="min-h-11 font-semibold text-amber-950 underline underline-offset-2"
            >
              Search again
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export function PropertyDataResult({
  result,
  onDownload,
  onRetry,
}: {
  result: DataAccessApiResult;
  onDownload: () => void;
  onRetry: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const datasets = Object.entries(result.datasets);
  const successfulCount = datasets.filter(
    ([, dataset]) => dataset.status === "success",
  ).length;
  const unavailableCount = datasets.filter(
    ([, dataset]) => dataset.status === "unavailable",
  ).length;

  useEffect(() => {
    headingRef.current?.focus();
  }, [result.resolvedAddress.addressId]);

  return (
    <section aria-labelledby="result-heading" className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-pool-blue-700 mb-2 text-xs font-bold tracking-[0.18em] uppercase">
            Official data result
          </p>
          <h2
            ref={headingRef}
            id="result-heading"
            tabIndex={-1}
            className="text-pool-950 text-2xl font-semibold tracking-tight sm:text-3xl"
          >
            {result.resolvedAddress.fullAddress}
          </h2>
          <p className="text-pool-500 mt-2 text-sm">
            Retrieved {formatDate(result.generatedAt)} · LINZ address ID{" "}
            {result.resolvedAddress.addressId}
          </p>
        </div>
        <button
          type="button"
          onClick={onDownload}
          className="border-pool-300 text-pool-800 hover:border-pool-blue-600 hover:text-pool-blue-800 focus-visible:outline-pool-blue-700 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border bg-white px-4 font-semibold shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <Download className="size-4" aria-hidden="true" />
          Download session assessment
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
          value={
            result.parcelMatch.status === "mapped_primary_parcel" &&
            result.identityCheck.distinctFromAlternatives
              ? "Confirmed"
              : "Manual review required"
          }
          detail={
            result.identityCheck.distinctFromAlternatives
              ? "Legal parcel separated from returned alternatives"
              : "Alternative address shares this parcel"
          }
        />
      </div>

      <PropertyAerialMap result={result} onRetry={onRetry} />

      <PoolScenarioComparisonResult comparison={result.scenarioComparison} />
      <FeasibilityAssessmentResult assessment={result.feasibilityAssessment} />
      {result.assessmentExplanation ? (
        <AssessmentExplanationResult
          explanation={result.assessmentExplanation}
        />
      ) : null}
      <SessionAssessmentResult assessment={buildSessionAssessment(result)} />

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.6fr]">
        <div className="space-y-6">
          <ResultPanel title="Property details">
            <DescriptionList
              items={[
                ["Parcel ID", result.parcel.parcelId],
                ["Appellation", result.parcel.appellation || "Not supplied"],
                ["Parcel intent", result.parcel.parcelIntent],
                ["Boundary state", humanize(result.boundaryState)],
                [
                  "Regional layer coverage",
                  humanize(result.regionCoverageState),
                ],
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
            <ul className="text-pool-700 space-y-3 text-sm">
              <CheckItem
                passed={result.identityCheck.exactAddressMatched}
                text="Exact supplied address matched"
              />
              <CheckItem
                passed={result.identityCheck.distinctFromAlternatives}
                text="Selected parcel separated from returned alternatives"
              />
              <CheckItem
                passed={
                  result.parcelMatch.status === "mapped_primary_parcel" &&
                  result.identityCheck.distinctFromAlternatives
                }
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
                <tr className="text-pool-500 text-xs tracking-wide uppercase">
                  <th className="border-pool-200 border-b px-3 py-3 font-semibold">
                    Dataset
                  </th>
                  <th className="border-pool-200 border-b px-3 py-3 font-semibold">
                    Provider
                  </th>
                  <th className="border-pool-200 border-b px-3 py-3 font-semibold">
                    Status
                  </th>
                  <th className="border-pool-200 border-b px-3 py-3 font-semibold">
                    Features
                  </th>
                  <th className="border-pool-200 border-b px-3 py-3 font-semibold">
                    Evidence use
                  </th>
                </tr>
              </thead>
              <tbody>
                {datasets.map(([key, dataset]) => (
                  <tr key={key} className="align-top">
                    <td className="border-pool-100 border-b px-3 py-3.5">
                      <p className="text-pool-900 font-medium">
                        {dataset.dataset}
                      </p>
                      {(dataset.reason || dataset.errorCode) && (
                        <p className="text-pool-500 mt-1 max-w-80 text-xs leading-5">
                          {dataset.reason ?? dataset.errorCode}
                        </p>
                      )}
                    </td>
                    <td className="border-pool-100 text-pool-600 border-b px-3 py-3.5">
                      {dataset.provider}
                    </td>
                    <td className="border-pool-100 border-b px-3 py-3.5">
                      <StatusBadge status={dataset.status} />
                    </td>
                    <td className="border-pool-100 text-pool-600 border-b px-3 py-3.5 tabular-nums">
                      {dataset.featureCount ?? "—"}
                    </td>
                    <td className="border-pool-100 text-pool-600 border-b px-3 py-3.5">
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
    <div className="border-pool-200 rounded-2xl border bg-white p-5 shadow-sm">
      <div className="bg-pool-100 text-pool-700 mb-4 flex size-10 items-center justify-center rounded-xl">
        {icon}
      </div>
      <p className="text-pool-500 text-xs font-semibold tracking-wide uppercase">
        {label}
      </p>
      <p className="text-pool-950 mt-2 font-semibold">{value}</p>
      <p className="text-pool-500 mt-1 text-sm">{detail}</p>
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
    <div className="border-pool-200 rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
      <h3 className="text-pool-950 mb-5 font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function DescriptionList({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="divide-pool-100 divide-y">
      {items.map(([label, value]) => (
        <div key={label} className="grid gap-1 py-3 first:pt-0 sm:grid-cols-2">
          <dt className="text-pool-500 text-sm">{label}</dt>
          <dd className="text-pool-800 text-sm font-medium break-words sm:text-right">
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
          className="text-pool-blue-700 mt-0.5 size-4 shrink-0"
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
      ? "bg-pool-blue-50 text-pool-blue-800 ring-pool-blue-600/20"
      : status === "error"
        ? "bg-red-50 text-red-800 ring-red-600/20"
        : "bg-pool-100 text-pool-700 ring-pool-500/20";

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${className}`}
    >
      {humanize(status)}
    </span>
  );
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
