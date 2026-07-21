import {
  BodyLimitError,
  fetchProviderBody,
  providerTimeoutMs,
} from "@/shared/http/provider-runtime";

const MAX_TILE_BYTES = 2_000_000;
const LINZ_AERIAL_TILE_BASE =
  "https://basemaps.linz.govt.nz/v1/tiles/aerial/3857/";

export type AerialTileCoordinate = { z: number; x: number; y: number };

export class LinzAerialTileError extends Error {
  constructor(
    readonly code:
      | "NOT_CONFIGURED"
      | "PROVIDER_REQUEST_FAILED"
      | "PROVIDER_RESPONSE_INVALID",
  ) {
    super(code);
    this.name = "LinzAerialTileError";
  }
}

export class LinzAerialTileGateway {
  readonly #apiKey: string | undefined;
  readonly #fetch: typeof fetch;
  readonly #timeoutMs: number;

  constructor(options?: {
    apiKey?: string;
    fetch?: typeof fetch;
    timeoutMs?: number;
  }) {
    this.#apiKey = options?.apiKey;
    this.#fetch = options?.fetch ?? fetch;
    this.#timeoutMs = options?.timeoutMs ?? providerTimeoutMs();
  }

  async fetchTile(tile: AerialTileCoordinate): Promise<{
    bytes: Uint8Array;
    contentType: string;
  }> {
    if (!this.#apiKey) {
      throw new LinzAerialTileError("NOT_CONFIGURED");
    }

    const url = new URL(
      `${LINZ_AERIAL_TILE_BASE}${tile.z}/${tile.x}/${tile.y}.webp`,
    );
    url.searchParams.set("api", this.#apiKey);

    let result: Awaited<ReturnType<typeof fetchProviderBody>>;
    try {
      result = await fetchProviderBody({
        provider: "linz",
        fetch: this.#fetch,
        url,
        init: { headers: { Accept: "image/webp" } },
        timeoutMs: this.#timeoutMs,
        maxBytes: MAX_TILE_BYTES,
      });
    } catch (error) {
      if (error instanceof BodyLimitError) {
        throw new LinzAerialTileError("PROVIDER_RESPONSE_INVALID");
      }
      throw new LinzAerialTileError("PROVIDER_REQUEST_FAILED");
    }

    const contentType = result.response.headers.get("content-type") ?? "";
    if (
      !result.response.ok ||
      !contentType.toLowerCase().startsWith("image/") ||
      !result.bytes
    ) {
      throw new LinzAerialTileError(
        result.response.ok
          ? "PROVIDER_RESPONSE_INVALID"
          : "PROVIDER_REQUEST_FAILED",
      );
    }

    return { bytes: result.bytes, contentType };
  }
}

export function parseAerialTileCoordinate(input: {
  z: string;
  x: string;
  y: string;
}): AerialTileCoordinate | null {
  if (![input.z, input.x, input.y].every((value) => /^\d+$/.test(value))) {
    return null;
  }

  const z = Number(input.z);
  const x = Number(input.x);
  const y = Number(input.y);
  const dimension = 2 ** z;
  return z <= 22 && x < dimension && y < dimension ? { z, x, y } : null;
}
