import "server-only";

import { handleAddressSuggestionsRequest } from "@/modules/data-access-spike/handle-address-suggestions-request";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return handleAddressSuggestionsRequest(request);
}
