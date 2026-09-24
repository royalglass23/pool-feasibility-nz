"use client";

import { useEffect, useRef, useState } from "react";
import type { ConstructabilityAnswers } from "@/modules/assessment/constructability-evidence";
import type {
  AccessRouteFacts,
  RouteFact,
} from "@/modules/spatial/analyse-access-route";
import type {
  AccessRouteGeometry,
  AccessRoutePlacement,
  AccessRouteResult,
} from "@/modules/spatial/suggest-access-route";

type AccessCondition = ConstructabilityAnswers["accessConditions"][number];
type NearbyFeature = ConstructabilityAnswers["nearbyFeatures"][number];
type Choice<T extends string> = { id: T; label: string };

const accessChoices: Choice<AccessCondition>[] = [
  { id: "gate_or_narrow_passage", label: "Restricted gate or narrow access" },
  {
    id: "steps_or_steep_level_change",
    label: "Steps or steep level change",
  },
  {
    id: "overhead_obstacle",
    label: "Overhead wires, branches, eaves or carport",
  },
  {
    id: "removable_feature",
    label: "Fence, landscaping or structure may require removal",
  },
  {
    id: "other_property_access",
    label: "Access may require neighbouring property",
  },
  { id: "retaining_wall", label: "Retaining wall near proposed pool area" },
  { id: "rocky_ground", label: "Rocky ground evident" },
  { id: "wet_or_soft_ground", label: "Wet or soft ground evident" },
  { id: "none_of_these", label: "None of these" },
  { id: "not_sure", label: "I’m not sure" },
];

const nearbyChoices: Choice<NearbyFeature>[] = [
  { id: "fences", label: "Fences" },
  { id: "walls", label: "Walls" },
  { id: "gates", label: "Gates" },
  { id: "doors_or_windows", label: "Doors or windows" },
  { id: "decks", label: "Decks" },
  { id: "raised_areas", label: "Raised areas or level changes" },
  { id: "trees_or_structures", label: "Trees or structures" },
  { id: "none_of_these", label: "None of these" },
  { id: "not_sure", label: "I’m not sure" },
];

function toggleExclusive<T extends string>(selected: T[], choice: T): T[] {
  if (selected.includes(choice))
    return selected.filter((value) => value !== choice);
  if (choice === "none_of_these" || choice === "not_sure") return [choice];
  return [
    ...selected.filter(
      (value) => value !== "none_of_these" && value !== "not_sure",
    ),
    choice,
  ];
}

export function SiteQuestions({
  assessmentSnapshot,
  placementKey,
  poolLayout,
  routeSuggestion,
  adjustedRoute,
  routeFacts,
  onRouteEdit,
  onRouteReset,
  onSigned,
}: {
  assessmentSnapshot: string;
  placementKey: string;
  poolLayout?: AccessRoutePlacement;
  routeSuggestion?: AccessRouteResult;
  adjustedRoute?: AccessRouteGeometry | null;
  routeFacts?: AccessRouteFacts | null;
  onRouteEdit?: (route: AccessRouteGeometry, complete: boolean) => void;
  onRouteReset?: () => void;
  onSigned: (
    signed: {
      sourceSnapshot: string;
      placementKey: string;
      snapshot: string;
      answers: ConstructabilityAnswers;
    } | null,
  ) => void;
}) {
  const [accessConditions, setAccessConditions] = useState<AccessCondition[]>(
    [],
  );
  const [nearbyFeatures, setNearbyFeatures] = useState<NearbyFeature[]>([]);
  const [sideClearanceMillimetres, setSideClearanceMillimetres] = useState(300);
  const [routeResponse, setRouteResponse] = useState<
    "confirm" | "adjust" | "not_sure" | null
  >(routeSuggestion?.confidence === "credible" ? null : "not_sure");
  const [errors, setErrors] = useState({ access: false, nearby: false });
  const [requestError, setRequestError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFacts, setSavedFacts] = useState<AccessRouteFacts | null>(null);
  const accessRef = useRef<HTMLFieldSetElement>(null);
  const routeRef = useRef<HTMLFieldSetElement>(null);
  const nearbyRef = useRef<HTMLFieldSetElement>(null);
  const requestGenerationRef = useRef(0);

  useEffect(
    () => () => {
      requestGenerationRef.current += 1;
    },
    [assessmentSnapshot, placementKey],
  );
  const effectiveRouteResponse =
    adjustedRoute && adjustedRoute.coordinates.length > 2
      ? "adjust"
      : routeResponse;

  async function continueToDetails() {
    const nextErrors = {
      access: accessConditions.length === 0,
      nearby: nearbyFeatures.length === 0,
    };
    if (routeSuggestion?.confidence === "credible" && !effectiveRouteResponse) {
      routeRef.current?.focus();
      return;
    }
    setErrors(nextErrors);
    if (nextErrors.access || nextErrors.nearby) {
      (nextErrors.access ? accessRef : nearbyRef).current?.focus();
      return;
    }
    if (saving) return;
    const generation = ++requestGenerationRef.current;
    setSaving(true);
    setRequestError(null);
    try {
      const response = await fetch(
        "/api/public/assessment-snapshot/site-answers",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assessmentSnapshot,
            ...(poolLayout
              ? {
                  poolLayout,
                  routeResponse: effectiveRouteResponse ?? "not_sure",
                }
              : {}),
            ...(effectiveRouteResponse === "adjust" && adjustedRoute
              ? { adjustedRoute }
              : {}),
            accessConditions,
            nearbyFeatures,
            sideClearanceMillimetres,
          }),
        },
      );
      const body = await response.json().catch(() => null);
      if (generation !== requestGenerationRef.current) return;
      if (
        !response.ok ||
        typeof body?.assessmentSnapshot !== "string" ||
        !body.answers
      ) {
        setRequestError(
          "We couldn’t save your Site answers. Your selections are still here. Please try again.",
        );
        return;
      }
      onSigned({
        sourceSnapshot: assessmentSnapshot,
        placementKey,
        snapshot: body.assessmentSnapshot,
        answers: body.answers,
      });
      setSavedFacts(body.routeFacts ?? null);
    } catch {
      if (generation !== requestGenerationRef.current) return;
      setRequestError(
        "We couldn’t save your Site answers. Your selections are still here. Please try again.",
      );
    } finally {
      if (generation === requestGenerationRef.current) setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="site-questions-heading"
        className="border-pool-200 space-y-6 rounded-2xl border bg-white p-5 sm:p-7"
      >
        <div>
          <h3
            id="site-questions-heading"
            className="text-pool-950 text-xl font-semibold"
          >
            Pool builder site questions
          </h3>
          <p className="text-pool-700 mt-2 max-w-4xl text-sm leading-6">
            Record the known site conditions for this preliminary builder
            assessment. Confirm all access, excavation and nearby features
            onsite before design or pricing.
          </p>
        </div>
        <fieldset
          ref={routeRef}
          tabIndex={-1}
          className="space-y-3 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <legend className="text-pool-950 font-semibold">
            Proposed construction access route
          </legend>
          {routeSuggestion?.confidence === "credible" ? (
            <p className="text-pool-700 text-sm">
              A preliminary route from the street to the selected pool area is
              shown on the map. Confirm it or adjust it to reflect the likely
              plant-access route. Verify all access onsite.
            </p>
          ) : (
            <p className="text-pool-700 text-sm">
              The mapped evidence did not support a credible construction access
              route. Record it as unconfirmed and verify access onsite.
            </p>
          )}
          {routeSuggestion?.confidence === "credible" && (
            <>
              <label className="border-pool-200 has-checked:border-pool-blue-700 has-checked:bg-pool-blue-50 focus-within:outline-pool-blue-700 flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition focus-within:outline-2 focus-within:outline-offset-2">
                <input
                  type="radio"
                  name="route-response"
                  checked={routeResponse === "confirm"}
                  onChange={() => {
                    requestGenerationRef.current += 1;
                    setSaving(false);
                    setRouteResponse("confirm");
                    setSavedFacts(null);
                    onRouteReset?.();
                    onSigned(null);
                  }}
                />
                Use proposed route
              </label>
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={(adjustedRoute?.coordinates.length ?? 2) >= 4}
                  onClick={() => {
                    const source = adjustedRoute ?? routeSuggestion.geometry;
                    const coordinates = [...source.coordinates];
                    const before = coordinates[coordinates.length - 2]!;
                    const after = coordinates[coordinates.length - 1]!;
                    coordinates.splice(coordinates.length - 1, 0, [
                      (before[0] + after[0]) / 2,
                      (before[1] + after[1]) / 2,
                    ]);
                    requestGenerationRef.current += 1;
                    setRouteResponse("adjust");
                    onRouteEdit?.({ type: "LineString", coordinates }, true);
                    onSigned(null);
                  }}
                  className="border-pool-300 hover:bg-pool-50 focus-visible:outline-pool-blue-700 min-h-11 rounded-lg border px-3 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Add route turning point
                </button>
                {adjustedRoute && adjustedRoute.coordinates.length > 2 && (
                  <>
                    <p className="text-sm font-semibold">
                      User-adjusted route — confirm onsite
                    </p>
                    <p className="text-sm">
                      Drag a turning point on the map, or focus it and use the
                      arrow keys. The street and pool-area endpoints stay fixed.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const coordinates = [...adjustedRoute.coordinates];
                        coordinates.splice(coordinates.length - 2, 1);
                        const next = {
                          type: "LineString" as const,
                          coordinates,
                        };
                        setRouteResponse(
                          coordinates.length > 2 ? "adjust" : null,
                        );
                        onRouteEdit?.(next, true);
                        onSigned(null);
                      }}
                      className="border-pool-300 hover:bg-pool-50 focus-visible:outline-pool-blue-700 min-h-11 rounded-lg border px-3 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      Remove last turning point
                    </button>
                  </>
                )}
                {(routeFacts ?? (adjustedRoute ? null : savedFacts)) && (
                  <dl
                    className="grid gap-1 text-sm"
                    aria-label="Preliminary access route facts"
                  >
                    {(
                      [
                        [
                          "Approximate length",
                          (routeFacts ?? savedFacts)!.length,
                          "m",
                        ],
                        [
                          "Elevation change",
                          (routeFacts ?? savedFacts)!.elevationChange,
                          "m",
                        ],
                        [
                          "Steepest mapped gradient",
                          (routeFacts ?? savedFacts)!.steepestGradient,
                          "°",
                        ],
                        [
                          "Parcel departure",
                          (routeFacts ?? savedFacts)!.parcelDeparture,
                          "",
                        ],
                        [
                          "Mapped-building intersection",
                          (routeFacts ?? savedFacts)!.buildings,
                          "",
                        ],
                        [
                          "Mapped-service intersection or close approach",
                          (routeFacts ?? savedFacts)!.services,
                          "",
                        ],
                      ] as const
                    ).map(([label, fact, suffix]) => (
                      <div key={label} className="flex justify-between gap-4">
                        <dt>{label}</dt>
                        <dd>{formatRouteFact(fact, suffix)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </>
          )}
          <label className="border-pool-200 has-checked:border-pool-blue-700 has-checked:bg-pool-blue-50 focus-within:outline-pool-blue-700 flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition focus-within:outline-2 focus-within:outline-offset-2">
            <input
              type="radio"
              name="route-response"
              checked={routeResponse === "not_sure"}
              onChange={() => {
                requestGenerationRef.current += 1;
                setSaving(false);
                setRouteResponse("not_sure");
                setSavedFacts(null);
                onRouteReset?.();
                onSigned(null);
              }}
            />
            Access route not confirmed
          </label>
        </fieldset>
        <fieldset
          ref={accessRef}
          tabIndex={-1}
          aria-describedby={errors.access ? "site-access-error" : undefined}
          className="border-pool-200 space-y-3 border-t pt-6 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <legend className="text-pool-950 font-semibold">
            Which visible site conditions could affect plant access or
            excavation?
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {accessChoices.map((choice) => (
              <label
                key={choice.id}
                className="border-pool-200 hover:border-pool-300 hover:bg-pool-50 has-checked:border-pool-blue-700 has-checked:bg-pool-blue-50 focus-within:outline-pool-blue-700 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition focus-within:outline-2 focus-within:outline-offset-2"
              >
                <input
                  type="checkbox"
                  checked={accessConditions.includes(choice.id)}
                  onChange={() => {
                    requestGenerationRef.current += 1;
                    setSaving(false);
                    setAccessConditions((current) =>
                      toggleExclusive(current, choice.id),
                    );
                    setErrors((current) => ({ ...current, access: false }));
                    onSigned(null);
                  }}
                  className="size-4 accent-blue-800"
                />
                {choice.label}
              </label>
            ))}
          </div>
          {errors.access && (
            <p
              id="site-access-error"
              role="alert"
              className="text-sm text-red-800"
            >
              Record at least one access or excavation condition.
            </p>
          )}
        </fieldset>
        <fieldset
          ref={nearbyRef}
          tabIndex={-1}
          aria-describedby={errors.nearby ? "site-nearby-error" : undefined}
          className="border-pool-200 space-y-3 border-t pt-6 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <legend className="text-pool-950 font-semibold">
            Which existing features are close to the proposed pool area?
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {nearbyChoices.map((choice) => (
              <label
                key={choice.id}
                className="border-pool-200 hover:border-pool-300 hover:bg-pool-50 has-checked:border-pool-blue-700 has-checked:bg-pool-blue-50 focus-within:outline-pool-blue-700 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition focus-within:outline-2 focus-within:outline-offset-2"
              >
                <input
                  type="checkbox"
                  checked={nearbyFeatures.includes(choice.id)}
                  onChange={() => {
                    requestGenerationRef.current += 1;
                    setSaving(false);
                    setNearbyFeatures((current) =>
                      toggleExclusive(current, choice.id),
                    );
                    setErrors((current) => ({ ...current, nearby: false }));
                    onSigned(null);
                  }}
                  className="size-4 accent-blue-800"
                />
                {choice.label}
              </label>
            ))}
          </div>
          {errors.nearby && (
            <p
              id="site-nearby-error"
              role="alert"
              className="text-sm text-red-800"
            >
              Record at least one nearby feature response.
            </p>
          )}
        </fieldset>
      </section>
      <section
        aria-labelledby="excavation-planning-heading"
        aria-describedby="excavation-side-clearance-help"
        className="border-pool-200 space-y-3 rounded-2xl border bg-white p-5 sm:p-7"
      >
        <h3
          id="excavation-planning-heading"
          className="text-pool-950 text-xl font-semibold"
        >
          Excavation planning
        </h3>
        <p
          id="excavation-side-clearance-help"
          className="text-pool-700 text-sm"
        >
          Choose a planning allowance from 200–600 mm. This is added on each
          side of the selected pool outline; it is not an installation
          requirement.
        </p>
        <div className="flex items-center gap-4">
          <input
            type="range"
            aria-label="Indicative excavation side clearance"
            aria-valuetext={`${sideClearanceMillimetres} mm each side`}
            min="200"
            max="600"
            step="50"
            value={sideClearanceMillimetres}
            onChange={(event) => {
              requestGenerationRef.current += 1;
              setSaving(false);
              setSideClearanceMillimetres(Number(event.target.value));
              onSigned(null);
            }}
            className="accent-pool-blue-800 min-h-11 w-full max-w-sm"
          />
          <output className="text-pool-950 min-w-28 text-sm font-semibold">
            {sideClearanceMillimetres} mm each side
          </output>
        </div>
        {sideClearanceMillimetres < 300 && (
          <p role="status" className="text-sm font-semibold text-amber-800">
            Needs checking — this is below the provisional 300 mm starting
            point. Confirm it against the selected pool installation
            instructions.
          </p>
        )}
        <p className="text-pool-600 text-xs leading-5">
          Base depth, drainage, ground slope, retaining and installation method
          are not included and still need professional confirmation.
        </p>
      </section>
      {requestError && (
        <p role="alert" className="text-sm text-red-800">
          {requestError}
        </p>
      )}
      <button
        type="button"
        disabled={saving}
        onClick={() => void continueToDetails()}
        className="bg-pool-950 hover:bg-pool-blue-800 focus-visible:outline-pool-blue-700 min-h-11 rounded-xl px-5 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
      >
        {saving ? "Saving Site answers…" : "Continue to your details"}
      </button>
    </div>
  );
}

function formatRouteFact(
  fact: RouteFact<number | boolean>,
  suffix: string,
): string {
  if (fact.status === "not_assessed")
    return fact.reason === "invalid_geometry"
      ? "Not assessed — invalid route geometry"
      : "Not assessed — data unavailable";
  if (typeof fact.value === "boolean")
    return fact.value
      ? "Potential consideration — confirm onsite"
      : "No mapped intersection identified — confirm onsite";
  return `${fact.value.toFixed(1)}${suffix}`;
}
