export type ClientApiError = {
  code: string;
  message?: string;
  correlationId?: string;
  retryAfterSeconds?: number;
};

export function readClientApiError(
  body: unknown,
  headers?: Pick<Headers, "get">,
): ClientApiError | null {
  if (!isRecord(body) || !isRecord(body.error)) return null;
  const { code, message, correlationId } = body.error;
  if (typeof code !== "string" || code.length === 0) return null;
  return {
    code,
    ...(typeof message === "string" ? { message } : {}),
    ...(typeof correlationId === "string" && correlationId.length <= 100
      ? { correlationId }
      : {}),
    ...readRetryAfter(headers),
  };
}

function readRetryAfter(
  headers?: Pick<Headers, "get">,
): Pick<ClientApiError, "retryAfterSeconds"> {
  const value = headers?.get("Retry-After")?.trim();
  if (!value || !/^\d+$/.test(value)) return {};
  const retryAfterSeconds = Number(value);
  return Number.isSafeInteger(retryAfterSeconds) && retryAfterSeconds > 0
    ? { retryAfterSeconds }
    : {};
}

export async function readClientApiErrorBlob(
  body: unknown,
): Promise<ClientApiError | null> {
  if (!(body instanceof Blob)) return null;
  try {
    return readClientApiError(JSON.parse(await body.text()));
  } catch {
    return null;
  }
}

export async function readClientApiErrorFromBlobError(
  error: unknown,
): Promise<ClientApiError | null> {
  return isRecord(error) ? readClientApiErrorBlob(error.body) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
