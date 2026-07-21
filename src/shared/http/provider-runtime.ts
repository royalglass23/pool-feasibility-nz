export const DEFAULT_PROVIDER_TIMEOUT_MS = 10_000;
export const DEFAULT_PROVIDER_RETRY_COUNT = 2;
export const DEFAULT_PROVIDER_CONCURRENCY_LIMIT = 4;

export type ProviderKey = "linz" | "auckland_council" | "watercare" | "openai";

const providerGates = new Map<ProviderKey, ProviderConcurrencyGate>();

export function providerTimeoutMs(
  environment: NodeJS.ProcessEnv = process.env,
): number {
  const configured = Number(environment.PROVIDER_TIMEOUT_MS);
  return Number.isInteger(configured) &&
    configured >= 1_000 &&
    configured <= 30_000
    ? configured
    : DEFAULT_PROVIDER_TIMEOUT_MS;
}

export function providerRetryCount(
  environment: NodeJS.ProcessEnv = process.env,
): number {
  const configured = Number(environment.PROVIDER_RETRY_COUNT);
  return Number.isInteger(configured) && configured >= 0 && configured <= 3
    ? configured
    : DEFAULT_PROVIDER_RETRY_COUNT;
}

export async function fetchProviderBody(input: {
  provider: ProviderKey;
  fetch: typeof fetch;
  url: URL;
  init: Omit<RequestInit, "signal">;
  timeoutMs: number;
  maxBytes: number;
  retryCount?: number;
  signal?: AbortSignal;
}): Promise<{ response: Response; bytes: Uint8Array | null }> {
  const gate = providerGate(input.provider);
  return gate.run(async () => {
    const retryCount = input.retryCount ?? providerRetryCount();
    let lastError: ProviderFetchError | undefined;

    for (let attempt = 0; attempt <= retryCount; attempt += 1) {
      let response: Response;
      try {
        const timeoutSignal = AbortSignal.timeout(input.timeoutMs);
        response = await input.fetch(input.url, {
          ...input.init,
          signal: input.signal
            ? AbortSignal.any([input.signal, timeoutSignal])
            : timeoutSignal,
        });
      } catch (error) {
        lastError = new ProviderFetchError(
          isTimeoutError(error)
            ? "PROVIDER_TIMEOUT"
            : "PROVIDER_REQUEST_FAILED",
        );
        if (input.signal?.aborted || attempt === retryCount) throw lastError;
        continue;
      }

      if (
        !response.ok &&
        isRetryableProviderStatus(response.status) &&
        attempt < retryCount
      ) {
        await cancelResponseBody(response, "PROVIDER_RETRY");
        continue;
      }

      if (!response.ok) {
        await cancelResponseBody(response, "PROVIDER_HTTP_ERROR");
        return { response, bytes: null };
      }

      const declaredLength = Number(
        response.headers.get("content-length") ?? 0,
      );
      if (declaredLength > input.maxBytes) {
        await cancelResponseBody(response, "BODY_TOO_LARGE");
        throw new BodyLimitError("BODY_TOO_LARGE");
      }

      return {
        response,
        bytes: await readResponseBytesWithinLimit(response, input.maxBytes),
      };
    }

    throw lastError ?? new ProviderFetchError("PROVIDER_REQUEST_FAILED");
  });
}

async function readResponseBytesWithinLimit(
  response: Response,
  maxBytes: number,
): Promise<Uint8Array> {
  return readBodyBytesWithinLimit(response.body, maxBytes);
}

export async function readRequestBytesWithinLimit(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > maxBytes) {
    throw new BodyLimitError("BODY_TOO_LARGE");
  }

  return readBodyBytesWithinLimit(request.body, maxBytes);
}

async function readBodyBytesWithinLimit(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<Uint8Array> {
  if (!body) {
    throw new BodyLimitError("BODY_MISSING");
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel("BODY_TOO_LARGE");
        throw new BodyLimitError("BODY_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export class BodyLimitError extends Error {
  constructor(readonly code: "BODY_MISSING" | "BODY_TOO_LARGE") {
    super(code);
    this.name = "BodyLimitError";
  }
}

export class ProviderFetchError extends Error {
  constructor(readonly code: "PROVIDER_TIMEOUT" | "PROVIDER_REQUEST_FAILED") {
    super(code);
    this.name = "ProviderFetchError";
  }
}

class ProviderConcurrencyGate {
  readonly #limit: number;
  #active = 0;
  readonly #waiters: Array<() => void> = [];

  constructor(limit: number) {
    this.#limit = limit;
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.#acquire();
    try {
      return await task();
    } finally {
      this.#release();
    }
  }

  async #acquire(): Promise<void> {
    if (this.#active < this.#limit) {
      this.#active += 1;
      return;
    }

    await new Promise<void>((resolve) => this.#waiters.push(resolve));
  }

  #release(): void {
    const next = this.#waiters.shift();
    if (next) {
      next();
      return;
    }
    this.#active -= 1;
  }
}

function providerGate(provider: ProviderKey): ProviderConcurrencyGate {
  const existing = providerGates.get(provider);
  if (existing) return existing;

  const gate = new ProviderConcurrencyGate(DEFAULT_PROVIDER_CONCURRENCY_LIMIT);
  providerGates.set(provider, gate);
  return gate;
}

function isRetryableProviderStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

async function cancelResponseBody(
  response: Response,
  reason: string,
): Promise<void> {
  try {
    await response.body?.cancel(reason);
  } catch {
    // The body may already be closed or errored; the provider permit still releases.
  }
}

function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  );
}
