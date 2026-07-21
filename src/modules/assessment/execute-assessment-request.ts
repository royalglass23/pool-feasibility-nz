import type { DataAccessSpikeGateway } from "@/modules/data-access-spike/data-access-gateway";
import {
  executeDataAccessRequest,
  type DataAccessRequestResponse,
} from "@/modules/data-access-spike/execute-data-access-request";
import {
  generateAssessmentExplanation,
  type AssessmentExplanation,
  type AssessmentNarrativeProvider,
} from "@/modules/recommendations/generate-assessment-explanation";

export type AssessmentRequestResponse =
  | Exclude<DataAccessRequestResponse, { ok: true }>
  | {
      ok: true;
      status: 200;
      data: Extract<DataAccessRequestResponse, { ok: true }>["data"] & {
        assessmentExplanation: AssessmentExplanation;
      };
    };

export interface NarrativeOutcomeEvent {
  event: "assessment_narrative";
  outcome: "success" | "fallback";
}

export async function executeAssessmentRequest(input: {
  body: unknown;
  gateway: DataAccessSpikeGateway;
  narrativeProvider: AssessmentNarrativeProvider;
  basemapApiKey?: string;
  now?: () => Date;
  narrativeTimeoutMs?: number;
  logNarrativeOutcome: (event: NarrativeOutcomeEvent) => void;
}): Promise<AssessmentRequestResponse> {
  const response = await executeDataAccessRequest({
    body: input.body,
    gateway: input.gateway,
    basemapApiKey: input.basemapApiKey,
    now: input.now,
  });
  if (!response.ok) return response;

  const assessmentExplanation = await generateAssessmentExplanation({
    result: response.data,
    provider: input.narrativeProvider,
    timeoutMs: input.narrativeTimeoutMs,
  });
  input.logNarrativeOutcome({
    event: "assessment_narrative",
    outcome: assessmentExplanation.source === "ai" ? "success" : "fallback",
  });

  return {
    ...response,
    data: { ...response.data, assessmentExplanation },
  };
}
