import "server-only";

import { z } from "zod";
import { OpenAiAerialImageryConflictProvider } from "@/modules/providers/openai-aerial-imagery-conflict-provider";
import {
  assessAerialImageryConflicts,
  type AerialConflictCandidate,
  type AerialImageryContext,
} from "@/modules/spatial/assess-aerial-imagery-conflicts";
import {
  authorizeInternalRequest,
  internalAccessDeniedResponse,
} from "@/modules/internal-access/authorize-internal-request";
import {
  BodyLimitError,
  readRequestBytesWithinLimit,
} from "@/shared/http/provider-runtime";
import {
  apiErrorResponse,
  apiJsonResponse,
  requestCorrelationId,
} from "@/shared/http/api-response";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 8_500_000;
const coordinate = z.number().finite();
const polygon = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.array(coordinate).min(2))).min(1),
});
const requestSchema = z.object({
  candidate: z.object({
    id: z.string().trim().min(1).max(100),
    envelope: z.object({
      type: z.literal("Feature"),
      properties: z.unknown().optional(),
      geometry: polygon,
    }),
    dimensions: z.object({
      lengthMetres: z.number().finite().positive().max(30),
      widthMetres: z.number().finite().positive().max(30),
    }),
    rotationDegrees: z.number().finite(),
  }),
  context: z.object({
    status: z.enum(["available", "unavailable"]),
    alignment: z.enum(["aligned", "uncertain", "unavailable"]),
    resolution: z.enum(["sufficient", "limited", "unavailable"]),
    evidenceId: z.string().trim().min(1).max(200),
    image: z
      .object({
        dataUrl: z.string().max(8_000_000),
        mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
      })
      .optional(),
  }),
});

export async function POST(request: Request): Promise<Response> {
  const correlationId = requestCorrelationId(request);
  const access = authorizeInternalRequest(request);
  if (!access.allowed)
    return internalAccessDeniedResponse(access, correlationId);

  let body: unknown;
  try {
    const bytes = await readRequestBytesWithinLimit(request, MAX_REQUEST_BYTES);
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    return apiErrorResponse(
      {
        code:
          error instanceof BodyLimitError
            ? "REQUEST_TOO_LARGE"
            : "INVALID_REQUEST",
        message: "Submit one bounded aerial conflict assessment request.",
      },
      error instanceof BodyLimitError ? 413 : 400,
      correlationId,
      { "Cache-Control": "no-store" },
    );
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return apiErrorResponse(
      {
        code: "INVALID_REQUEST",
        message: "The aerial conflict request is invalid.",
      },
      400,
      correlationId,
      { "Cache-Control": "no-store" },
    );
  }

  const provider =
    process.env.AI_PROVIDER === "openai" && process.env.OPENAI_API_KEY
      ? new OpenAiAerialImageryConflictProvider({
          apiKey: process.env.OPENAI_API_KEY,
          model: process.env.OPENAI_MODEL ?? "gpt-5.6-luna",
        })
      : undefined;
  const assessment = await assessAerialImageryConflicts({
    candidate: parsed.data.candidate as AerialConflictCandidate,
    context: parsed.data.context as AerialImageryContext,
    provider,
  });

  return apiJsonResponse(
    {
      ...assessment,
      providerFailure:
        Boolean(provider) &&
        parsed.data.context.status === "available" &&
        parsed.data.context.alignment === "aligned" &&
        parsed.data.context.resolution === "sufficient" &&
        assessment.source === "fallback",
    },
    200,
    correlationId,
    {
      "Cache-Control": "no-store",
    },
  );
}
