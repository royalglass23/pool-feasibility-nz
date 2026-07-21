import "server-only";
import { executeAssessmentRequest } from "./execute-assessment-request";
import { OfficialGisGateway } from "@/modules/providers/official-gis-gateway";
import { OpenAiAssessmentNarrativeProvider } from "@/modules/providers/openai-assessment-narrative-provider";
import type { AssessmentNarrativeProvider } from "@/modules/recommendations/generate-assessment-explanation";
import { providerTimeoutMs } from "@/shared/http/provider-runtime";
import pino from "pino";

const logger = pino({ base: undefined });

export async function executeConfiguredAssessmentRequest(body: unknown) {
  return executeAssessmentRequest({
    body,
    gateway: new OfficialGisGateway({ timeoutMs: providerTimeoutMs() }),
    narrativeProvider: configuredNarrativeProvider(),
    basemapApiKey: process.env.LINZ_BASEMAPS_API_KEY || undefined,
    narrativeTimeoutMs: Math.min(providerTimeoutMs(), 5_000),
    logNarrativeOutcome: (event) => logger.info(event),
  });
}

function configuredNarrativeProvider(): AssessmentNarrativeProvider {
  const apiKey = process.env.OPENAI_API_KEY;
  if (process.env.AI_PROVIDER === "openai" && apiKey) {
    return new OpenAiAssessmentNarrativeProvider({
      apiKey,
      model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
    });
  }

  return {
    explain: async () => {
      throw new Error("ASSESSMENT_NARRATIVE_PROVIDER_UNAVAILABLE");
    },
  };
}
