export type ClientApiError = {
  code: string;
  message?: string;
  correlationId?: string;
};

export function readClientApiError(body: unknown): ClientApiError | null {
  if (!isRecord(body) || !isRecord(body.error)) return null;
  const { code, message, correlationId } = body.error;
  if (typeof code !== "string" || code.length === 0) return null;
  return {
    code,
    ...(typeof message === "string" ? { message } : {}),
    ...(typeof correlationId === "string" && correlationId.length <= 100
      ? { correlationId }
      : {}),
  };
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

export function withErrorReference(
  message: string,
  error?: Pick<ClientApiError, "correlationId"> | null,
): string {
  return error?.correlationId
    ? `${message} Reference: ${error.correlationId}.`
    : message;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
