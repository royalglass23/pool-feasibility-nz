"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { AlertTriangle, LoaderCircle, MapPin, RefreshCw } from "lucide-react";
import { AssessmentWorkspace } from "@/components/assessment-workspace";
import { FieldValidationMessage } from "@/components/field-validation-message";
import type { DataAccessSpikeResult } from "@/modules/data-access-spike/run-data-access-spike";
import type { AddressMatch } from "@/modules/data-access-spike/data-access-gateway";
import type { DataAccessRequestError } from "@/modules/data-access-spike/execute-data-access-request";
import { buildSessionAssessment } from "@/modules/assessment/build-session-assessment";
import type { AssessmentExplanation } from "@/modules/recommendations/generate-assessment-explanation";
import {
  FastPropertyView,
  type FastPropertyViewMapSnapshot,
} from "@/components/fast-property-view";
import { HomeownerSubmissionForm } from "@/components/homeowner-submission-form";
import {
  SiteQuestions,
  type BuilderSiteQuestionDraft,
} from "@/components/site-questions";
import type { ConstructabilityAnswers } from "@/modules/assessment/constructability-evidence";
import {
  DEFAULT_ESTIMATED_POOL_DEPTH_METRES,
  parseEstimatedPoolDepth,
} from "@/modules/assessment/estimated-pool-depth";
import { ActionProgressDialog } from "@/components/action-progress-dialog";
import {
  SavedAssessmentReportPanel,
  useSavedAssessmentReport,
} from "@/components/saved-assessment-report-panel";
import type { FastPropertyViewResult } from "@/modules/data-access-spike/fast-property-view";
import type { FastPropertyDetails } from "@/modules/data-access-spike/execute-fast-property-details";
import type { FastPropertyViewRequestError } from "@/modules/data-access-spike/execute-fast-property-view-request";
import type { FastPoolPlacementSnapshot } from "@/modules/data-access-spike/fast-pool-warning";
import { suggestAccessRouteFromProperty } from "@/modules/spatial/suggest-access-route";
import type { AccessRouteGeometry } from "@/modules/spatial/suggest-access-route";
import {
  analyseAccessRouteFromProperty,
  type AccessRouteFacts,
} from "@/modules/spatial/analyse-access-route";
import { trackAnonymousFunnelEvent } from "@/modules/anonymous-funnel-analytics";
import {
  readClientApiError,
  type ClientApiError,
} from "@/shared/http/client-api-error";
import { ReportAudiencePathway } from "@/components/report-audience-pathway";
import {
  PropertyCheckJourneyNav,
  type PropertyCheckStage,
} from "@/components/property-check-journey-nav";
import type { ReportAudience } from "@/modules/assessment/report-audience";
import { useSearchParams } from "next/navigation";

type DataAccessApiResult = DataAccessSpikeResult & {
  assessmentExplanation?: AssessmentExplanation;
  reportToken: string;
};

type FastApiResponse =
  | { data: FastPropertyViewResult; assessmentSnapshot: string }
  | {
      error: ClientApiError &
        Partial<
          Pick<FastPropertyViewRequestError, "options" | "boundaryState">
        >;
    };

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

type PropertyCheckIssue = {
  title: string;
  message: string;
  troubleshooting: string;
  allowAddressChange?: boolean;
};

function placementIdentity(placement: FastPoolPlacementSnapshot): string {
  return JSON.stringify([
    placement.layoutId,
    placement.layoutName,
    placement.position,
    placement.dimensions,
    placement.rotationDegrees,
    placement.constructionEnvelopeWithinMappedArea,
  ]);
}

export function PropertyCheckJourneyEntry() {
  const searchParams = useSearchParams();
  const initialReportAudience =
    searchParams.get("audience") === "pool_builder" ? "pool_builder" : null;

  return (
    <PropertyCheckJourney
      key={initialReportAudience ?? "generic"}
      initialReportAudience={initialReportAudience}
    />
  );
}

export function PropertyCheckJourney({
  initialReportAudience = null,
}: {
  initialReportAudience?: ReportAudience | null;
}) {
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
  const [estimatedDepth, setEstimatedDepth] = useState(
    String(DEFAULT_ESTIMATED_POOL_DEPTH_METRES),
  );
  const [lockedDepth, setLockedDepth] = useState<number | null>(null);
  const [preDetailedSnapshot, setPreDetailedSnapshot] = useState<string | null>(
    null,
  );
  const [signedSiteAnswers, setSignedSiteAnswers] = useState<{
    sourceSnapshot: string;
    placementKey: string;
    snapshot: string;
    answers: ConstructabilityAnswers;
  } | null>(null);
  const [routeDraft, setRouteDraft] = useState<{
    placementKey: string;
    geometry: AccessRouteGeometry;
  } | null>(null);
  const [routeFacts, setRouteFacts] = useState<{
    placementKey: string;
    facts: AccessRouteFacts;
  } | null>(null);
  const [fastPlacementSnapshot, setFastPlacementSnapshot] =
    useState<FastPoolPlacementSnapshot | null>(null);
  const [confirmedPlacementKey, setConfirmedPlacementKey] = useState<
    string | null
  >(null);
  const [fastMapSnapshot, setFastMapSnapshot] =
    useState<FastPropertyViewMapSnapshot | null>(null);
  const [reportAudience, setReportAudience] = useState<ReportAudience | null>(
    initialReportAudience,
  );
  const [currentStage, setCurrentStage] =
    useState<PropertyCheckStage>("audience");
  const fastSavedReport = useSavedAssessmentReport();
  const [error, setError] = useState<PropertyCheckIssue | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [addressOptions, setAddressOptions] = useState<AddressOption[]>([]);
  const [canRetry, setCanRetry] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isLoadingDetailed, setIsLoadingDetailed] = useState(false);
  const [detailedRetryAfterSeconds, setDetailedRetryAfterSeconds] = useState<
    number | null
  >(null);
  const detailedRequestInFlightRef = useRef(false);
  const detailedStartedRef = useRef(false);
  const fastRequestIdRef = useRef(0);
  const focusedDetailsForRef = useRef<string | null>(null);
  const focusedPlanningForRef = useRef<string | null>(null);
  const builderDraftVersionRef = useRef(0);
  const [suggestionMessage, setSuggestionMessage] = useState<string | null>(
    null,
  );
  const isEnteringAddress =
    !pendingSelectedAddress &&
    !fastResult &&
    !result &&
    !fastSavedReport.assessment;
  const placementKey = fastPlacementSnapshot
    ? placementIdentity(fastPlacementSnapshot)
    : null;
  const routePoolLayout = useMemo(
    () =>
      fastPlacementSnapshot?.dimensions
        ? {
            layoutId: fastPlacementSnapshot.layoutId,
            layoutName: fastPlacementSnapshot.layoutName,
            position: fastPlacementSnapshot.position,
            lengthMetres: fastPlacementSnapshot.dimensions.lengthMetres,
            widthMetres: fastPlacementSnapshot.dimensions.widthMetres,
            rotationDegrees: fastPlacementSnapshot.rotationDegrees,
          }
        : null,
    [fastPlacementSnapshot],
  );
  const routeSuggestion = useMemo(
    () =>
      fastResult && routePoolLayout
        ? suggestAccessRouteFromProperty(fastResult, routePoolLayout)
        : null,
    [fastResult, routePoolLayout],
  );
  const handleFastPlacementChange = useCallback(
    (placement: FastPoolPlacementSnapshot) => {
      setFastPlacementSnapshot(placement);
      setFastMapSnapshot(null);
      setRouteDraft((current) =>
        current?.placementKey === placementIdentity(placement) ? current : null,
      );
      setRouteFacts((current) =>
        current?.placementKey === placementIdentity(placement) ? current : null,
      );
      const nextKey = placementIdentity(placement);
      setConfirmedPlacementKey((current) =>
        current === nextKey ? current : null,
      );
      setSignedSiteAnswers((current) =>
        current?.placementKey === nextKey ? current : null,
      );
    },
    [],
  );
  const handleRouteEdit = useCallback(
    (geometry: AccessRouteGeometry, complete: boolean) => {
      if (!placementKey || !fastResult) return;
      setRouteDraft({ placementKey, geometry });
      setRouteFacts(
        complete
          ? {
              placementKey,
              facts: analyseAccessRouteFromProperty(fastResult, geometry),
            }
          : null,
      );
      setSignedSiteAnswers(null);
      setFastMapSnapshot(null);
    },
    [fastResult, placementKey],
  );

  useEffect(() => {
    if (detailedRetryAfterSeconds === null) return;
    const timeout = window.setTimeout(
      () => setDetailedRetryAfterSeconds(null),
      detailedRetryAfterSeconds * 1_000,
    );
    return () => window.clearTimeout(timeout);
  }, [detailedRetryAfterSeconds]);

  useEffect(() => {
    if (!confirmedPlacementKey || confirmedPlacementKey !== placementKey) {
      focusedPlanningForRef.current = null;
      return;
    }
    const focusKey = `${reportAudience}:${confirmedPlacementKey}`;
    if (focusedPlanningForRef.current === focusKey) return;
    const heading = document.getElementById(
      reportAudience === "pool_builder"
        ? "site-questions-heading"
        : "homeowner-check-heading",
    );
    if (heading) {
      heading.focus();
      focusedPlanningForRef.current = focusKey;
    }
  }, [confirmedPlacementKey, placementKey, reportAudience]);

  useEffect(() => {
    const focusKey =
      reportAudience === "homeowner" &&
      fastAssessmentSnapshot &&
      placementKey &&
      fastMapSnapshot &&
      fastResult?.detailedChecks
        ? `homeowner:${fastAssessmentSnapshot}:${placementKey}`
        : signedSiteAnswers &&
            signedSiteAnswers.sourceSnapshot === fastAssessmentSnapshot &&
            signedSiteAnswers.placementKey === placementKey &&
            fastMapSnapshot
          ? `builder:${signedSiteAnswers.snapshot}:${signedSiteAnswers.placementKey}`
          : null;
    if (!focusKey) {
      focusedDetailsForRef.current = null;
      return;
    }
    if (focusedDetailsForRef.current !== focusKey) {
      const heading = document.getElementById("homeowner-details-heading");
      if (heading) {
        heading.focus();
        focusedDetailsForRef.current = focusKey;
      }
    }
  }, [
    signedSiteAnswers,
    fastAssessmentSnapshot,
    placementKey,
    fastMapSnapshot,
    fastResult?.detailedChecks,
    reportAudience,
  ]);

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
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          setAddressOptions([]);
          setSuggestionMessage(
            addressSuggestionIssue(readClientApiError(body)),
          );
          return;
        }
        const successBody = body as {
          suggestions?: AddressOption[];
        };
        const nextSuggestions = successBody.suggestions ?? [];
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
    setAddressError(null);
    setSelectedAddressId(option.addressId);
    setPendingSelectedAddress({
      addressId: option.addressId,
      fullAddress: option.fullAddress,
    });
    setAddressOptions([]);
    void requestPropertyData(option.addressId, option.fullAddress);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;

    const requestedAddress = address.trim();
    if (requestedAddress.length < 8) {
      setAddressError(
        requestedAddress.length === 0
          ? "Please fill in this field."
          : "Enter your full street address, including the street number.",
      );
      return;
    }
    setAddressError(null);

    const onlyAddress = addressOptions.length === 1 ? addressOptions[0] : null;
    await requestPropertyData(
      selectedAddressId ?? onlyAddress?.addressId,
      onlyAddress?.fullAddress,
    );
  }

  async function requestPropertyData(
    selectedId?: string,
    addressOverride?: string,
  ) {
    if (isLoading) return;

    const requestedAddress = (addressOverride ?? address).trim();
    if (requestedAddress.length < 8) {
      setError({
        title: "Choose a full property address",
        message:
          "Start with the street number and street name, then choose your address from the list.",
        troubleshooting:
          "Add the suburb or city if you cannot see the right address.",
      });
      setCanRetry(false);
      return;
    }

    trackAnonymousFunnelEvent({ name: "address_search_started" });
    const requestId = ++fastRequestIdRef.current;
    detailedStartedRef.current = false;
    setIsLoading(true);
    setError(null);
    setCanRetry(false);
    setResult(null);
    setFastResult(null);
    setPendingSelectedAddress((current) =>
      selectedId && current?.addressId === selectedId ? current : null,
    );
    setFastAssessmentSnapshot(null);
    setEstimatedDepth(String(DEFAULT_ESTIMATED_POOL_DEPTH_METRES));
    setLockedDepth(null);
    setPreDetailedSnapshot(null);
    setSignedSiteAnswers(null);
    setRouteDraft(null);
    setRouteFacts(null);
    setFastPlacementSnapshot(null);
    setConfirmedPlacementKey(null);
    setFastMapSnapshot(null);
    setDetailedRetryAfterSeconds(null);
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
      const body = (await response
        .json()
        .catch(() => null)) as FastApiResponse | null;
      const responseError = readClientApiError(body);

      if (!response.ok || !body || "error" in body) {
        if (
          body &&
          "error" in body &&
          responseError?.code === "ADDRESS_AMBIGUOUS" &&
          body.error.options?.length
        ) {
          setAddressOptions(body.error.options);
          setSuggestionMessage("Choose the right address from the list.");
        } else {
          setError(propertyCheckIssue(responseError));
          setCanRetry(
            responseError?.code === "DATA_PROVIDER_ERROR" ||
              responseError?.code === "ANALYSIS_FAILED" ||
              responseError?.code === "RATE_LIMIT_UNAVAILABLE",
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
      setCurrentStage("placement");
      setPendingSelectedAddress(null);
      setFastAssessmentSnapshot(body.assessmentSnapshot);
      setSignedSiteAnswers(null);
      trackAnonymousFunnelEvent({ name: "property_check_completed" });
      setCanRetry(false);
      void requestFastStages(body.data, body.assessmentSnapshot, requestId);
    } catch {
      setError({
        title: "We couldn't connect to GeoMap",
        message: "Your property check did not reach us.",
        troubleshooting:
          "Check your internet connection, then try again. If other websites are working, wait a minute and retry.",
      });
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
      const body = (await response.json().catch(() => null)) as {
        data?: Pick<
          FastPropertyViewResult,
          "boundary" | "aerial" | "datasets" | "progress" | "fastPathDurationMs"
        >;
        assessmentSnapshot?: string;
        error?: { code?: string; message?: string; correlationId?: string };
      } | null;
      const responseError = readClientApiError(body);
      if (
        !response.ok ||
        !body?.data ||
        !body.assessmentSnapshot ||
        fastRequestIdRef.current !== requestId
      ) {
        if (fastRequestIdRef.current === requestId) {
          setError(detailedChecksIssue(responseError));
          setCanRetry(responseError?.code !== "RATE_LIMITED");
        }
        return;
      }
      if (detailedStartedRef.current) return;
      setFastResult((current) =>
        current?.resolvedAddress.addressId === initial.resolvedAddress.addressId
          ? { ...current, ...body.data }
          : current,
      );
      setFastAssessmentSnapshot(body.assessmentSnapshot);
      setSignedSiteAnswers(null);
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

  async function requestDetailedPropertyData(
    depthOverride?: number,
  ): Promise<{ data: FastPropertyDetails; assessmentSnapshot: string } | null> {
    const builderDepth =
      depthOverride ?? lockedDepth ?? parseEstimatedPoolDepth(estimatedDepth);
    if (
      !fastResult ||
      !fastAssessmentSnapshot ||
      (reportAudience === "pool_builder" && builderDepth === null) ||
      isLoadingDetailed ||
      detailedRequestInFlightRef.current
    )
      return null;
    const requestId = fastRequestIdRef.current;
    const sourceSnapshot = fastAssessmentSnapshot;
    detailedRequestInFlightRef.current = true;
    detailedStartedRef.current = true;
    if (preDetailedSnapshot === null) setPreDetailedSnapshot(sourceSnapshot);
    if (reportAudience === "pool_builder") setLockedDepth(builderDepth);
    setIsLoadingDetailed(true);
    try {
      const response = await fetch("/api/public/property-check/stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "detailed",
          ...(reportAudience === "pool_builder" && builderDepth !== null
            ? { estimatedDepthMetres: builderDepth }
            : {}),
          addressId: fastResult.resolvedAddress.addressId,
          coordinates: fastResult.resolvedAddress.coordinates,
          assessmentSnapshot: fastAssessmentSnapshot,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        data?: FastPropertyDetails;
        assessmentSnapshot?: string;
        error?: { code?: string; message?: string; correlationId?: string };
      } | null;
      const responseError = readClientApiError(body, response.headers);
      if (
        !response.ok ||
        !body?.data ||
        !body.assessmentSnapshot ||
        fastRequestIdRef.current !== requestId
      ) {
        setDetailedRetryAfterSeconds(responseError?.retryAfterSeconds ?? null);
        setError(detailedChecksIssue(responseError));
        setCanRetry(responseError?.code !== "RATE_LIMITED");
        return null;
      }
      setFastAssessmentSnapshot(body.assessmentSnapshot);
      setSignedSiteAnswers(null);
      setFastResult((current) =>
        current ? { ...current, detailedChecks: body.data } : current,
      );
      setError(null);
      setDetailedRetryAfterSeconds(null);
      return {
        data: body.data,
        assessmentSnapshot: body.assessmentSnapshot,
      };
    } catch {
      setError(detailedChecksIssue());
      setCanRetry(true);
      return null;
    } finally {
      detailedRequestInFlightRef.current = false;
      setIsLoadingDetailed(false);
    }
  }

  async function saveBuilderSiteAnswers({
    assessmentSnapshot,
    draft,
    routeResponse,
    adjustedRoute,
    expectedDraftVersion,
  }: {
    assessmentSnapshot: string;
    draft: BuilderSiteQuestionDraft;
    routeResponse: "suggested" | "adjust" | "not_sure";
    adjustedRoute?: AccessRouteGeometry;
    expectedDraftVersion: number;
  }): Promise<boolean> {
    if (!placementKey || !routePoolLayout) return false;
    try {
      const response = await fetch(
        "/api/public/assessment-snapshot/site-answers",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assessmentSnapshot,
            poolLayout: routePoolLayout,
            routeResponse,
            ...(adjustedRoute ? { adjustedRoute } : {}),
            ...draft,
          }),
        },
      );
      const body = (await response.json().catch(() => null)) as {
        assessmentSnapshot?: string;
        answers?: ConstructabilityAnswers;
        routeFacts?: AccessRouteFacts | null;
      } | null;
      if (
        !response.ok ||
        typeof body?.assessmentSnapshot !== "string" ||
        !body.answers ||
        builderDraftVersionRef.current !== expectedDraftVersion
      )
        return false;
      setSignedSiteAnswers({
        sourceSnapshot: assessmentSnapshot,
        placementKey,
        snapshot: body.assessmentSnapshot,
        answers: body.answers,
      });
      setRouteFacts(
        body.routeFacts ? { placementKey, facts: body.routeFacts } : null,
      );
      return true;
    } catch {
      return false;
    }
  }

  async function checkBuilderProperty(
    draft: BuilderSiteQuestionDraft,
  ): Promise<boolean> {
    const expectedDraftVersion = builderDraftVersionRef.current;
    const depth = parseEstimatedPoolDepth(estimatedDepth);
    if (depth === null || !fastResult || !routePoolLayout) {
      document.getElementById("estimated-pool-depth")?.focus();
      return false;
    }
    if (fastResult.detailedChecks && fastAssessmentSnapshot) {
      return saveBuilderSiteAnswers({
        assessmentSnapshot: fastAssessmentSnapshot,
        draft,
        routeResponse:
          routeSuggestion?.confidence === "credible" ? "suggested" : "not_sure",
        expectedDraftVersion,
      });
    }
    const detailed = await requestDetailedPropertyData(depth);
    if (!detailed) return false;
    const checkedResult: FastPropertyViewResult = {
      ...fastResult,
      detailedChecks: detailed.data,
    };
    const suggestion = suggestAccessRouteFromProperty(
      checkedResult,
      routePoolLayout,
    );
    return saveBuilderSiteAnswers({
      assessmentSnapshot: detailed.assessmentSnapshot,
      draft,
      routeResponse:
        suggestion.confidence === "credible" ? "suggested" : "not_sure",
      expectedDraftVersion,
    });
  }

  async function saveBuilderRouteAdjustment(
    draft: BuilderSiteQuestionDraft & { adjustedRoute: AccessRouteGeometry },
  ): Promise<boolean> {
    if (!fastAssessmentSnapshot) return false;
    const expectedDraftVersion = builderDraftVersionRef.current;
    return saveBuilderSiteAnswers({
      assessmentSnapshot: fastAssessmentSnapshot,
      draft,
      routeResponse: "adjust",
      adjustedRoute: draft.adjustedRoute,
      expectedDraftVersion,
    });
  }

  function handleBuilderDraftChange() {
    builderDraftVersionRef.current += 1;
    setSignedSiteAnswers(null);
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
    detailedStartedRef.current = false;
    setAddress("");
    setSelectedAddressId(null);
    setResult(null);
    setFastResult(null);
    setPendingSelectedAddress(null);
    setFastAssessmentSnapshot(null);
    setEstimatedDepth(String(DEFAULT_ESTIMATED_POOL_DEPTH_METRES));
    setLockedDepth(null);
    setPreDetailedSnapshot(null);
    setSignedSiteAnswers(null);
    setFastPlacementSnapshot(null);
    setConfirmedPlacementKey(null);
    setFastMapSnapshot(null);
    setError(null);
    setCanRetry(false);
    setAddressOptions([]);
    setSuggestionMessage(null);
    fastSavedReport.resetReport();
    setCurrentStage(reportAudience ? "property" : "audience");
  }

  const completedStages = useMemo<PropertyCheckStage[]>(() => {
    const completed: PropertyCheckStage[] = [];
    if (reportAudience) completed.push("audience");
    if (fastResult || result) completed.push("property");
    if (
      placementKey &&
      confirmedPlacementKey === placementKey &&
      fastPlacementSnapshot?.constructionEnvelopeWithinMappedArea
    ) {
      completed.push("placement");
    }
    const builderDetailsComplete = Boolean(
      reportAudience === "pool_builder" &&
      signedSiteAnswers?.sourceSnapshot === fastAssessmentSnapshot &&
      signedSiteAnswers?.placementKey === placementKey,
    );
    if (
      (reportAudience === "homeowner" && Boolean(fastResult?.detailedChecks)) ||
      builderDetailsComplete
    ) {
      completed.push("details");
    }
    if (fastSavedReport.assessment) {
      completed.push("contact", "report");
    }
    return completed;
  }, [
    confirmedPlacementKey,
    fastAssessmentSnapshot,
    fastPlacementSnapshot?.constructionEnvelopeWithinMappedArea,
    fastResult,
    fastSavedReport.assessment,
    placementKey,
    reportAudience,
    result,
    signedSiteAnswers,
  ]);

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
        description="Reviewing available official datasets for your preliminary report."
      />
      <PropertyCheckJourneyNav
        currentStage={currentStage}
        completedStages={completedStages}
        onNavigate={setCurrentStage}
      />

      {currentStage === "audience" && (
        <section className="border-pool-200 rounded-[3px] border bg-white p-5 sm:p-7">
          <h2 className="text-pool-950 text-xl font-semibold">
            Who is this for?
          </h2>
          <div className="mt-4">
            <ReportAudiencePathway
              value={reportAudience}
              onChange={(nextAudience) => {
                if (nextAudience !== reportAudience) setSignedSiteAnswers(null);
                setReportAudience(nextAudience);
              }}
            />
          </div>
          <button
            type="button"
            disabled={!reportAudience}
            onClick={() =>
              setCurrentStage(
                fastResult || result
                  ? placementKey && confirmedPlacementKey === placementKey
                    ? "details"
                    : "placement"
                  : "property",
              )
            }
            className="bg-pool-950 hover:bg-pool-blue-800 focus-visible:outline-pool-blue-700 mt-5 min-h-11 rounded-[3px] px-5 font-semibold text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Continue
          </button>
        </section>
      )}

      {currentStage === "property" && isEnteringAddress && (
        <form
          onSubmit={handleSubmit}
          noValidate
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
              <p id="property-address-help" className="text-pool-600 text-sm">
                Start with your street number and street name, then choose the
                matching address from the suggestions.
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
                  setIsSuggesting(false);
                  setAddressError(null);
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
                placeholder="e.g. 123 Example Street"
                className="border-pool-200 bg-pool-50 text-pool-950 placeholder:text-pool-600 focus:border-pool-blue-600 focus:ring-pool-blue-600/10 min-h-13 w-full rounded-2xl border px-4 text-base transition outline-none focus:bg-white focus:ring-4 aria-[invalid=true]:border-orange-600 aria-[invalid=true]:focus:border-orange-600 aria-[invalid=true]:focus:ring-orange-100"
                aria-invalid={addressError ? true : undefined}
                aria-describedby={
                  addressError
                    ? "property-address-help property-address-error"
                    : "property-address-help"
                }
                aria-autocomplete="list"
                aria-controls="address-suggestions"
              />
              {addressError && (
                <FieldValidationMessage id="property-address-error">
                  {addressError}
                </FieldValidationMessage>
              )}
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
                  Searching addresses…
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
              <div
                role="alert"
                className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-950 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle
                    className="mt-0.5 size-4 shrink-0 text-red-700"
                    aria-hidden="true"
                  />
                  <div className="text-sm leading-6">
                    <p className="font-semibold">{error.title}</p>
                    <p>{error.message}</p>
                    <p className="mt-1 text-red-800">
                      <span className="font-semibold">What to try: </span>
                      {error.troubleshooting}
                    </p>
                  </div>
                </div>
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

      {currentStage === "property" && fastResult && (
        <section className="border-pool-200 rounded-[3px] border bg-white p-5 sm:p-7">
          <h2 className="text-pool-950 text-xl font-semibold">
            Find the property
          </h2>
          <p className="text-pool-700 mt-2 text-sm leading-6">
            {fastResult.resolvedAddress.fullAddress}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setCurrentStage("placement")}
              className="bg-pool-950 hover:bg-pool-blue-800 focus-visible:outline-pool-blue-700 min-h-11 rounded-[3px] px-5 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Continue to pool placement
            </button>
            <button
              type="button"
              onClick={startAgain}
              className="border-pool-300 text-pool-800 hover:bg-pool-50 focus-visible:outline-pool-blue-700 min-h-11 rounded-[3px] border bg-white px-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Change address
            </button>
          </div>
        </section>
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
              <p className="font-semibold">{error.title}</p>
              <p className="mt-1">{error.message}</p>
              <p className="mt-1">
                <span className="font-semibold">What to try: </span>
                {error.troubleshooting}
              </p>
              <div className="mt-3 flex flex-wrap gap-4">
                {canRetry && (
                  <button
                    type="button"
                    onClick={() => void requestPropertyData()}
                    className="min-h-11 font-semibold text-amber-950 underline underline-offset-2 hover:text-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-800"
                  >
                    Try property check again
                  </button>
                )}
                {error.allowAddressChange !== false && (
                  <button
                    type="button"
                    onClick={startAgain}
                    className="min-h-11 font-semibold text-amber-950 underline underline-offset-2 hover:text-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-800"
                  >
                    Search a different address
                  </button>
                )}
              </div>
            </div>
          )}
          <div hidden={currentStage !== "placement"}>
            <FastPropertyView
              result={fastResult}
              suggestedRoute={
                reportAudience === "pool_builder"
                  ? routeDraft?.placementKey === placementKey
                    ? routeDraft.geometry
                    : (routeSuggestion?.geometry ?? null)
                  : null
              }
              editableRoute={
                reportAudience === "pool_builder" &&
                routeSuggestion?.confidence === "credible" &&
                placementKey &&
                fastResult.detailedChecks
                  ? routeDraft?.placementKey === placementKey
                    ? routeDraft.geometry
                    : routeSuggestion.geometry
                  : null
              }
              onRouteEdit={handleRouteEdit}
              onConfirmPlacement={() => {
                if (placementKey) {
                  setConfirmedPlacementKey(placementKey);
                  setCurrentStage("details");
                }
              }}
              onRetry={() => void requestDetailedPropertyData()}
              onStartAgain={startAgain}
              isLoadingDetailed={isLoadingDetailed}
              onPlacementChange={handleFastPlacementChange}
              onSnapshotReady={setFastMapSnapshot}
              placementConfirmed={confirmedPlacementKey === placementKey}
              isDetailedRateLimited={detailedRetryAfterSeconds !== null}
              planningEnabled
            />
          </div>
          {(currentStage === "details" || currentStage === "contact") &&
          fastPlacementSnapshot?.dimensions &&
          fastPlacementSnapshot.constructionEnvelopeWithinMappedArea &&
          fastAssessmentSnapshot &&
          reportAudience &&
          confirmedPlacementKey === placementKey &&
          placementKey ? (
            <div hidden={currentStage !== "details"}>
              {reportAudience === "homeowner" ? (
                fastResult.detailedChecks ? (
                  <section className="border-pool-200 rounded-[3px] border bg-white p-5 sm:p-7">
                    <h3 className="text-pool-950 text-xl font-semibold">
                      Property details checked
                    </h3>
                    <p className="text-pool-700 mt-2 text-sm leading-6">
                      Continue to add your details and create the property
                      report.
                    </p>
                    <button
                      type="button"
                      onClick={() => setCurrentStage("contact")}
                      className="bg-pool-950 hover:bg-pool-blue-800 focus-visible:outline-pool-blue-700 mt-5 min-h-11 rounded-[3px] px-5 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      Continue to your details
                    </button>
                  </section>
                ) : (
                  <section className="border-pool-200 rounded-2xl border bg-white p-5 sm:p-7">
                    <h3
                      id="homeowner-check-heading"
                      tabIndex={-1}
                      className="text-pool-950 text-xl font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      Ready to check this property
                    </h3>
                    <p className="text-pool-700 mt-2 max-w-3xl text-sm leading-6">
                      We’ll check the available mapped property information for
                      the pool position you confirmed.
                    </p>
                    <button
                      type="button"
                      onClick={async () => {
                        const detailed = await requestDetailedPropertyData();
                        if (detailed) setCurrentStage("contact");
                      }}
                      disabled={
                        isLoadingDetailed || detailedRetryAfterSeconds !== null
                      }
                      className="bg-pool-950 hover:bg-pool-blue-800 focus-visible:outline-pool-blue-700 mt-5 min-h-11 rounded-xl px-5 font-semibold text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
                    >
                      {isLoadingDetailed
                        ? "Checking this property…"
                        : "Check this property"}
                    </button>
                  </section>
                )
              ) : (
                <>
                  <SiteQuestions
                    key={placementKey}
                    placementKey={placementKey}
                    estimatedDepth={estimatedDepth}
                    depthLocked={lockedDepth !== null}
                    onEstimatedDepthChange={setEstimatedDepth}
                    onEditEstimatedDepth={() => {
                      if (!preDetailedSnapshot || isLoadingDetailed) return;
                      setFastAssessmentSnapshot(preDetailedSnapshot);
                      setPreDetailedSnapshot(null);
                      setFastResult((current) =>
                        current
                          ? { ...current, detailedChecks: undefined }
                          : current,
                      );
                      setSignedSiteAnswers(null);
                      setRouteDraft(null);
                      setRouteFacts(null);
                      setFastMapSnapshot(null);
                      setLockedDepth(null);
                    }}
                    hasCompletedCheck={Boolean(fastResult.detailedChecks)}
                    hasSavedAnswers={Boolean(
                      signedSiteAnswers?.sourceSnapshot ===
                        fastAssessmentSnapshot &&
                      signedSiteAnswers.placementKey === placementKey,
                    )}
                    isChecking={isLoadingDetailed}
                    routeSuggestion={routeSuggestion ?? undefined}
                    adjustedRoute={
                      routeDraft?.placementKey === placementKey
                        ? routeDraft.geometry
                        : null
                    }
                    routeFacts={
                      routeFacts?.placementKey === placementKey
                        ? routeFacts.facts
                        : null
                    }
                    onRouteEdit={handleRouteEdit}
                    onDraftChange={handleBuilderDraftChange}
                    onCheckProperty={async (draft) => {
                      const saved = await checkBuilderProperty(draft);
                      if (saved) setCurrentStage("contact");
                      return saved;
                    }}
                    onSaveRouteAdjustment={async (draft) => {
                      const saved = await saveBuilderRouteAdjustment(draft);
                      if (saved) setCurrentStage("contact");
                      return saved;
                    }}
                  />
                </>
              )}
            </div>
          ) : null}

          {currentStage === "contact" &&
          fastMapSnapshot &&
          fastPlacementSnapshot?.dimensions &&
          reportAudience &&
          fastAssessmentSnapshot ? (
            <HomeownerSubmissionForm
              reportAudience={reportAudience}
              assessmentSnapshot={
                reportAudience === "pool_builder" && signedSiteAnswers
                  ? signedSiteAnswers.snapshot
                  : fastAssessmentSnapshot
              }
              constructability={
                reportAudience === "pool_builder"
                  ? signedSiteAnswers?.answers
                  : undefined
              }
              mapImageDataUrl={fastMapSnapshot.imageDataUrl}
              mapVisibleLayerKeys={fastMapSnapshot.visibleLayerKeys}
              placement={fastPlacementSnapshot}
              onSaved={(assessment) => {
                fastSavedReport.saveAssessment(assessment);
                setCurrentStage("report");
              }}
            />
          ) : null}
        </>
      )}

      {currentStage === "report" && fastSavedReport.assessment && (
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

function propertyCheckIssue(error: ClientApiError | null): PropertyCheckIssue {
  switch (error?.code) {
    case "INVALID_ADDRESS":
      return {
        title: "Choose a full property address",
        message:
          "We need a street number, street name, and suburb or city to check a property.",
        troubleshooting:
          "Start typing the address, then choose the matching result from the list.",
      };
    case "ADDRESS_NOT_FOUND":
      return {
        title: "We couldn't find that address",
        message:
          "It did not match an address in the New Zealand property index.",
        troubleshooting:
          "Check the street number and spelling, add the suburb, then choose a result from the list.",
      };
    case "TEMPORARILY_UNAVAILABLE":
      return {
        title: "Address search is temporarily unavailable",
        message: "The official address service is not responding right now.",
        troubleshooting:
          "Check your internet connection, wait a minute, then try again.",
      };
    case "RATE_LIMITED":
      return {
        title: "Too many property checks for now",
        message:
          "This connection has reached the temporary Property Check limit.",
        troubleshooting: "Please wait before trying again.",
      };
    case "RATE_LIMIT_UNAVAILABLE":
      return {
        title: "Property check protection is temporarily unavailable",
        message:
          "The request limit service did not respond, so we did not start the property check.",
        troubleshooting: "Please try again shortly.",
      };
    case "DATA_PROVIDER_ERROR":
      return {
        title: "We couldn't load the property information",
        message: "One of the official map services did not respond in time.",
        troubleshooting:
          "Try again in a minute. If it keeps happening, come back later rather than changing a correct address.",
      };
    case "ANALYSIS_FAILED":
      return {
        title: "We couldn't prepare a property view",
        message: "The property check did not finish on our side.",
        troubleshooting:
          "Try again in a minute. Your address has not been changed.",
      };
    default:
      return {
        title: "We couldn't complete that property check",
        message: "Your property view was not ready this time.",
        troubleshooting:
          "Check your internet connection, then try again. If it keeps happening, return a little later.",
      };
  }
}

function detailedChecksIssue(
  error?: ClientApiError | null,
): PropertyCheckIssue {
  if (error?.code === "RATE_LIMITED")
    return {
      title: "Detailed checks are temporarily unavailable",
      message: "You can still use your preliminary property view.",
      troubleshooting: error.retryAfterSeconds
        ? `Please try again in ${formatRetryInterval(error.retryAfterSeconds)}.`
        : "Please try the detailed checks again later.",
      allowAddressChange: false,
    };
  if (error?.code === "RATE_LIMIT_UNAVAILABLE")
    return {
      title: "Detailed checks are temporarily unavailable",
      message: "You can still use your preliminary property view.",
      troubleshooting: "Please try the detailed checks again shortly.",
    };
  return {
    title: "Your property view is ready, but some map checks are not",
    message:
      "We could not load every detailed official map layer. Your preliminary property view is still available.",
    troubleshooting:
      "Use the view as an early guide only, then try the property check again in a minute to load the missing detail.",
  };
}

function formatRetryInterval(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const parts = [];
  if (minutes > 0) parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
  if (remainingSeconds > 0)
    parts.push(
      `${remainingSeconds} second${remainingSeconds === 1 ? "" : "s"}`,
    );
  return parts.join(" ");
}

function addressSuggestionIssue(error: ClientApiError | null): string {
  if (error?.code === "RATE_LIMITED")
    return "Address suggestions are paused because this connection has reached its temporary limit. Please wait before trying again.";
  if (error?.code === "RATE_LIMIT_UNAVAILABLE")
    return "Address suggestions are paused because the request limit service is unavailable. Please try again shortly.";
  return "Address suggestions are temporarily unavailable.";
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
  error: PropertyCheckIssue | null;
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
          <p className="font-semibold">{error.title}</p>
          <p className="mt-1">{error.message}</p>
          <p className="mt-1">
            <span className="font-semibold">What to try: </span>
            {error.troubleshooting}
          </p>
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
