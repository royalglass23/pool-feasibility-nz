const correlationIdPattern = /^[A-Za-z0-9._:-]{1,100}$/;

export function requestCorrelationId(request: Request): string {
  const supplied = request.headers.get("x-correlation-id")?.trim();
  return supplied && correlationIdPattern.test(supplied)
    ? supplied
    : crypto.randomUUID();
}

export function responseHeaders(
  correlationId: string,
  initial?: HeadersInit,
): Headers {
  const headers = new Headers(initial);
  headers.set("X-Correlation-ID", correlationId);
  return headers;
}

export function apiJsonResponse(
  body: unknown,
  status: number,
  correlationId: string,
  initialHeaders?: HeadersInit,
): Response {
  return Response.json(body, {
    status,
    headers: responseHeaders(correlationId, initialHeaders),
  });
}

export function apiErrorResponse(
  error: { code: string; message: string; [key: string]: unknown },
  status: number,
  correlationId: string,
  initialHeaders?: HeadersInit,
): Response {
  return apiJsonResponse(
    { error: { ...error, correlationId } },
    status,
    correlationId,
    initialHeaders,
  );
}
