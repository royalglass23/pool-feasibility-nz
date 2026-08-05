import "server-only";

import { handleFastPropertyStagesRequest } from "@/modules/data-access-spike/handle-fast-property-stages-request";
import { enforcePublicPropertyStageRateLimit } from "@/modules/rate-limit/public-rate-limit";

export function POST(request: Request): Promise<Response> {
  return handleFastPropertyStagesRequest(request, async (input) =>
    enforcePublicPropertyStageRateLimit({
      request: input.request,
      correlationId: input.correlationId,
      submissionId: input.snapshot.submissionId,
    }),
  );
}

export const runtime = "nodejs";
