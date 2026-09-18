"use client";

import { useEffect, useRef, useState } from "react";
import type { ConstructabilityAnswers } from "@/modules/assessment/constructability-evidence";
import type {
  AccessRoutePlacement,
  AccessRouteResult,
} from "@/modules/spatial/suggest-access-route";

type AccessCondition = ConstructabilityAnswers["accessConditions"][number];
type NearbyFeature = ConstructabilityAnswers["nearbyFeatures"][number];
type Choice<T extends string> = { id: T; label: string };

const accessChoices: Choice<AccessCondition>[] = [
  { id: "gate_or_narrow_passage", label: "Gate or narrow passage" },
  { id: "steps_or_steep_level_change", label: "Steps or a steep level change" },
  {
    id: "overhead_obstacle",
    label: "Overhead wires, branches, roof or carport",
  },
  {
    id: "removable_feature",
    label: "Fence, landscaping or structure that may need removal",
  },
  {
    id: "other_property_access",
    label: "Possible access through another property",
  },
  { id: "retaining_wall", label: "Retaining wall near the pool" },
  { id: "rocky_ground", label: "Apparently rocky ground" },
  { id: "wet_or_soft_ground", label: "Apparently wet or soft ground" },
  { id: "none_of_these", label: "None of these" },
  { id: "not_sure", label: "I’m not sure" },
];

const nearbyChoices: Choice<NearbyFeature>[] = [
  { id: "fences", label: "Fences" },
  { id: "walls", label: "Walls" },
  { id: "gates", label: "Gates" },
  { id: "doors_or_windows", label: "Doors or windows" },
  { id: "decks", label: "Decks" },
  { id: "raised_areas", label: "Raised areas" },
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
  onSigned,
}: {
  assessmentSnapshot: string;
  placementKey: string;
  poolLayout?: AccessRoutePlacement;
  routeSuggestion?: AccessRouteResult;
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
  const [routeResponse, setRouteResponse] = useState<
    "confirm" | "not_sure" | null
  >(routeSuggestion?.confidence === "credible" ? null : "not_sure");
  const [errors, setErrors] = useState({ access: false, nearby: false });
  const [requestError, setRequestError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
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

  async function continueToDetails() {
    const nextErrors = {
      access: accessConditions.length === 0,
      nearby: nearbyFeatures.length === 0,
    };
    if (routeSuggestion?.confidence === "credible" && !routeResponse) {
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
              ? { poolLayout, routeResponse: routeResponse ?? "not_sure" }
              : {}),
            accessConditions,
            nearbyFeatures,
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
    <section
      aria-labelledby="site-questions-heading"
      className="border-pool-200 space-y-6 rounded-2xl border bg-white p-5 sm:p-7"
    >
      <div>
        <h3
          id="site-questions-heading"
          className="text-pool-950 text-xl font-semibold"
        >
          Site questions
        </h3>
        <p className="text-pool-700 mt-2 text-sm">
          Select what you can see or know. A pool professional can check these
          conditions onsite.
        </p>
      </div>
      <fieldset
        ref={routeRef}
        tabIndex={-1}
        className="space-y-3 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <legend className="text-pool-950 font-semibold">
          Suggested access route
        </legend>
        {routeSuggestion?.confidence === "credible" ? (
          <p className="text-pool-700 text-sm">
            A preliminary straight route is shown on the map. Please confirm
            whether it looks plausible. A pool professional must check access
            onsite.
          </p>
        ) : (
          <p className="text-pool-700 text-sm">
            We couldn’t identify an obvious access route from the mapped
            evidence. You can still complete your property check.
          </p>
        )}
        {routeSuggestion?.confidence === "credible" && (
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="radio"
              name="route-response"
              checked={routeResponse === "confirm"}
              onChange={() => {
                requestGenerationRef.current += 1;
                setSaving(false);
                setRouteResponse("confirm");
                onSigned(null);
              }}
            />
            Confirm route
          </label>
        )}
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="radio"
            name="route-response"
            checked={routeResponse === "not_sure"}
            onChange={() => {
              requestGenerationRef.current += 1;
              setSaving(false);
              setRouteResponse("not_sure");
              onSigned(null);
            }}
          />
          I’m not sure
        </label>
      </fieldset>
      <fieldset
        ref={accessRef}
        tabIndex={-1}
        aria-describedby={errors.access ? "site-access-error" : undefined}
        className="space-y-3 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <legend className="text-pool-950 font-semibold">
          Are there any visible conditions that could affect construction access
          or excavation?
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {accessChoices.map((choice) => (
            <label
              key={choice.id}
              className="border-pool-200 hover:bg-pool-50 flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2 text-sm"
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
            Choose at least one answer for construction access or excavation.
          </p>
        )}
      </fieldset>
      <fieldset
        ref={nearbyRef}
        tabIndex={-1}
        aria-describedby={errors.nearby ? "site-nearby-error" : undefined}
        className="space-y-3 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <legend className="text-pool-950 font-semibold">
          Which existing features are close to the proposed pool area?
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {nearbyChoices.map((choice) => (
            <label
              key={choice.id}
              className="border-pool-200 hover:bg-pool-50 flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2 text-sm"
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
            Choose at least one answer for nearby features.
          </p>
        )}
      </fieldset>
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
    </section>
  );
}
