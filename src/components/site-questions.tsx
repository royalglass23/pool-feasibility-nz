"use client";

import { useEffect, useRef, useState } from "react";
import { EstimatedPoolDepth } from "@/components/estimated-pool-depth";
import type { ConstructabilityAnswers } from "@/modules/assessment/constructability-evidence";

type AccessCondition = ConstructabilityAnswers["accessConditions"][number];
type NearbyFeature = ConstructabilityAnswers["nearbyFeatures"][number];
type Choice<T extends string> = { id: T; label: string };

export type BuilderSiteQuestionDraft = {
  accessConditions: AccessCondition[];
  nearbyFeatures: NearbyFeature[];
  sideClearanceMillimetres: number;
};

export const DEFAULT_BUILDER_SITE_QUESTION_DRAFT: BuilderSiteQuestionDraft = {
  accessConditions: [],
  nearbyFeatures: [],
  sideClearanceMillimetres: 300,
};

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

function MultiSelectDropdown<T extends string>({
  id,
  label,
  question,
  choices,
  selected,
  open,
  error,
  errorText,
  locked,
  buttonRef,
  onOpenChange,
  onChoiceChange,
}: {
  id: string;
  label: string;
  question: string;
  choices: Choice<T>[];
  selected: T[];
  open: boolean;
  error: boolean;
  errorText: string;
  locked: boolean;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  onOpenChange: (open: boolean) => void;
  onChoiceChange: (choice: T) => void;
}) {
  const panelId = `${id}-panel`;
  const questionId = `${id}-question`;
  const errorId = `${id}-error`;
  const selectedChoices = choices.filter((choice) =>
    selected.includes(choice.id),
  );

  return (
    <div className="border-pool-200 space-y-3 border-t pt-6">
      <p id={questionId} className="text-pool-950 font-semibold">
        {question}
      </p>
      {!locked && (
        <button
          ref={buttonRef}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-describedby={error ? errorId : questionId}
          onClick={() => onOpenChange(!open)}
          className="border-pool-300 focus-visible:outline-pool-blue-700 flex min-h-11 w-full items-center justify-between rounded-[3px] border bg-white px-4 py-2 text-left text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <span>{label}</span>
          <span aria-hidden="true">{open ? "Close" : "Choose"}</span>
        </button>
      )}
      {selectedChoices.length > 0 ? (
        <div
          className="flex flex-wrap gap-2"
          aria-label={`${label} selected answers`}
        >
          {selectedChoices.map((choice) =>
            locked ? (
              <span
                key={choice.id}
                className="bg-pool-blue-50 text-pool-blue-900 rounded-full px-3 py-2 text-sm font-medium"
              >
                {choice.label}
              </span>
            ) : (
              <button
                key={choice.id}
                type="button"
                aria-label={`Remove ${choice.label}`}
                onClick={() => onChoiceChange(choice.id)}
                className="bg-pool-blue-50 text-pool-blue-900 focus-visible:outline-pool-blue-700 min-h-9 rounded-full px-3 py-1 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {choice.label} <span aria-hidden="true">×</span>
              </button>
            ),
          )}
        </div>
      ) : (
        <p className="text-pool-600 text-sm">No answers selected</p>
      )}
      <fieldset
        id={panelId}
        hidden={locked || !open}
        aria-describedby={error ? errorId : undefined}
        className="border-pool-200 space-y-3 rounded-[3px] border bg-white p-3"
      >
        <legend className="sr-only">{question}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {choices.map((choice) => (
            <label
              key={choice.id}
              className="border-pool-200 hover:border-pool-300 hover:bg-pool-50 has-checked:border-pool-blue-700 has-checked:bg-pool-blue-50 focus-within:outline-pool-blue-700 flex min-h-11 cursor-pointer items-center gap-3 rounded-[3px] border px-3 py-2 text-sm transition focus-within:outline-2 focus-within:outline-offset-2"
            >
              <input
                type="checkbox"
                checked={selected.includes(choice.id)}
                onChange={() => onChoiceChange(choice.id)}
                className="size-4 accent-blue-800"
              />
              {choice.label}
            </label>
          ))}
        </div>
      </fieldset>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-red-800">
          {errorText}
        </p>
      )}
    </div>
  );
}

export function SiteQuestions({
  placementKey,
  initialDraft = DEFAULT_BUILDER_SITE_QUESTION_DRAFT,
  estimatedDepth,
  depthLocked,
  onEstimatedDepthChange,
  hasCompletedCheck,
  hasSavedAnswers,
  isChecking,
  onDraftChange,
  onCheckProperty,
  onContinue,
}: {
  placementKey: string;
  initialDraft?: BuilderSiteQuestionDraft;
  estimatedDepth: string;
  depthLocked: boolean;
  onEstimatedDepthChange: (value: string) => void;
  hasCompletedCheck: boolean;
  hasSavedAnswers: boolean;
  isChecking: boolean;
  onDraftChange: (draft: BuilderSiteQuestionDraft) => void;
  onCheckProperty: (draft: BuilderSiteQuestionDraft) => Promise<boolean>;
  onContinue: () => void;
}) {
  const [accessConditions, setAccessConditions] = useState<AccessCondition[]>(
    initialDraft.accessConditions,
  );
  const [nearbyFeatures, setNearbyFeatures] = useState<NearbyFeature[]>(
    initialDraft.nearbyFeatures,
  );
  const [sideClearanceMillimetres, setSideClearanceMillimetres] = useState(
    initialDraft.sideClearanceMillimetres,
  );
  const [errors, setErrors] = useState({ access: false, nearby: false });
  const [accessOpen, setAccessOpen] = useState(false);
  const [nearbyOpen, setNearbyOpen] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const accessRef = useRef<HTMLButtonElement>(null);
  const nearbyRef = useRef<HTMLButtonElement>(null);
  const requestGenerationRef = useRef(0);

  useEffect(
    () => () => {
      requestGenerationRef.current += 1;
    },
    [placementKey],
  );

  function currentDraft(): BuilderSiteQuestionDraft {
    return { accessConditions, nearbyFeatures, sideClearanceMillimetres };
  }

  async function checkProperty() {
    const nextErrors = {
      access: accessConditions.length === 0,
      nearby: nearbyFeatures.length === 0,
    };
    setErrors(nextErrors);
    if (nextErrors.access || nextErrors.nearby) {
      if (nextErrors.access) setAccessOpen(true);
      else setNearbyOpen(true);
      (nextErrors.access ? accessRef : nearbyRef).current?.focus();
      return;
    }
    if (saving || isChecking) return;
    const generation = ++requestGenerationRef.current;
    setSaving(true);
    setRequestError(null);
    try {
      const succeeded = await onCheckProperty(currentDraft());
      if (generation !== requestGenerationRef.current) return;
      if (!succeeded) {
        setRequestError(
          "We couldn’t complete the property check. Your selections are still here. Please try again.",
        );
      }
    } catch {
      if (generation !== requestGenerationRef.current) return;
      setRequestError(
        "We couldn’t complete the property check. Your selections are still here. Please try again.",
      );
    } finally {
      if (generation === requestGenerationRef.current) setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="site-questions-heading"
        className="border-pool-200 space-y-6 rounded-[3px] border bg-white p-5 sm:p-7"
      >
        <div>
          <h3
            id="site-questions-heading"
            tabIndex={-1}
            className="text-pool-950 text-xl font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Pool builder site questions
          </h3>
          <p className="text-pool-700 mt-2 max-w-4xl text-sm leading-6">
            Record the known site conditions for this preliminary builder
            assessment. Confirm all access, excavation and nearby features
            onsite before design or pricing.
          </p>
        </div>
        <div
          data-testid="builder-planning-row"
          className="grid gap-4 lg:grid-cols-2"
        >
          <div
            data-testid="estimated-depth-planning"
            className="border-pool-200 rounded-[3px] border p-4 sm:p-5"
          >
            <EstimatedPoolDepth
              value={estimatedDepth}
              locked={depthLocked}
              onChange={onEstimatedDepthChange}
            />
          </div>
          <section
            data-testid="excavation-planning"
            aria-labelledby="excavation-planning-heading"
            aria-describedby={
              hasCompletedCheck
                ? "excavation-professional-help"
                : "excavation-side-clearance-help excavation-professional-help"
            }
            className="border-pool-200 space-y-3 rounded-[3px] border p-4 sm:p-5"
          >
            <h3
              id="excavation-planning-heading"
              className="text-pool-950 text-lg font-semibold"
            >
              Excavation planning
            </h3>
            {!hasCompletedCheck && (
              <p
                id="excavation-side-clearance-help"
                className="text-pool-700 text-sm leading-6 lg:min-h-12"
              >
                Choose a planning allowance from 200–600 mm. This is added on
                each side of the selected pool outline; it is not an
                installation requirement.
              </p>
            )}
            {hasCompletedCheck ? (
              <p className="text-pool-950 text-sm font-semibold">
                Selected allowance: {sideClearanceMillimetres} mm each side
              </p>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                <input
                  type="range"
                  aria-label="Indicative excavation side clearance"
                  aria-valuetext={`${sideClearanceMillimetres} mm each side`}
                  min="200"
                  max="600"
                  step="50"
                  value={sideClearanceMillimetres}
                  onChange={(event) => {
                    const nextSideClearanceMillimetres = Number(
                      event.target.value,
                    );
                    requestGenerationRef.current += 1;
                    setSaving(false);
                    onDraftChange({
                      ...currentDraft(),
                      sideClearanceMillimetres: nextSideClearanceMillimetres,
                    });
                    setSideClearanceMillimetres(nextSideClearanceMillimetres);
                  }}
                  className="accent-pool-blue-800 min-h-11 w-full"
                />
                <output className="text-pool-950 min-w-28 text-sm font-semibold">
                  {sideClearanceMillimetres} mm each side
                </output>
              </div>
            )}
            {sideClearanceMillimetres < 300 && (
              <p role="status" className="text-sm font-semibold text-amber-800">
                Confirm this allowance — it is below the provisional 300 mm
                starting point. Check it against the selected pool installation
                instructions.
              </p>
            )}
            <p
              id="excavation-professional-help"
              className="text-pool-600 text-xs leading-5"
            >
              Additional base preparation, drainage, ground slope, retaining and
              installation method are not included and still need professional
              confirmation.
            </p>
          </section>
        </div>
        <MultiSelectDropdown
          id="site-access"
          label="Access and excavation conditions"
          question="Which visible site conditions could affect plant access or excavation?"
          choices={accessChoices}
          selected={accessConditions}
          open={accessOpen}
          error={errors.access}
          errorText="Record at least one access or excavation condition."
          locked={hasCompletedCheck}
          buttonRef={accessRef}
          onOpenChange={setAccessOpen}
          onChoiceChange={(choice) => {
            const nextAccessConditions = toggleExclusive(
              accessConditions,
              choice,
            );
            requestGenerationRef.current += 1;
            setSaving(false);
            onDraftChange({
              ...currentDraft(),
              accessConditions: nextAccessConditions,
            });
            setAccessConditions(nextAccessConditions);
            setErrors((current) => ({ ...current, access: false }));
          }}
        />
        <MultiSelectDropdown
          id="site-nearby"
          label="Nearby features"
          question="Which existing features are close to the proposed pool area?"
          choices={nearbyChoices}
          selected={nearbyFeatures}
          open={nearbyOpen}
          error={errors.nearby}
          errorText="Record at least one nearby feature response."
          locked={hasCompletedCheck}
          buttonRef={nearbyRef}
          onOpenChange={setNearbyOpen}
          onChoiceChange={(choice) => {
            const nextNearbyFeatures = toggleExclusive(nearbyFeatures, choice);
            requestGenerationRef.current += 1;
            setSaving(false);
            onDraftChange({
              ...currentDraft(),
              nearbyFeatures: nextNearbyFeatures,
            });
            setNearbyFeatures(nextNearbyFeatures);
            setErrors((current) => ({ ...current, nearby: false }));
          }}
        />
      </section>
      {requestError && (
        <p role="alert" className="text-sm text-red-800">
          {requestError}
        </p>
      )}
      {!hasSavedAnswers && (
        <button
          type="button"
          disabled={saving || isChecking}
          onClick={() => void checkProperty()}
          className="bg-pool-950 hover:bg-pool-blue-800 focus-visible:outline-pool-blue-700 min-h-11 rounded-[3px] px-5 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
        >
          {saving || isChecking
            ? "Checking this property…"
            : hasCompletedCheck
              ? "Save builder answers"
              : "Check for constraints"}
        </button>
      )}
      {hasSavedAnswers && (
        <button
          type="button"
          onClick={onContinue}
          className="bg-pool-950 hover:bg-pool-blue-800 focus-visible:outline-pool-blue-700 min-h-11 rounded-[3px] px-5 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Continue to your details
        </button>
      )}
    </div>
  );
}
