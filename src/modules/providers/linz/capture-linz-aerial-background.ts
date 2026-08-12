import "server-only";

import sharp from "sharp";
import {
  LinzAerialTileGateway,
  type AerialTileCoordinate,
} from "@/modules/providers/linz/linz-aerial-tile-gateway";

type AerialTileGateway = Pick<LinzAerialTileGateway, "fetchTile">;

export type AerialCaptureViewport = {
  zoom: number;
  left: number;
  top: number;
  width: number;
  height: number;
};

export async function captureLinzAerialBackground(
  viewport: AerialCaptureViewport,
  options?: { aerialTileGateway?: AerialTileGateway },
): Promise<Uint8Array> {
  const gateway =
    options?.aerialTileGateway ??
    new LinzAerialTileGateway({
      apiKey: process.env.LINZ_BASEMAPS_API_KEY,
    });
  const firstTileX = Math.floor(viewport.left / 256);
  const firstTileY = Math.floor(viewport.top / 256);
  const lastTileX = Math.floor((viewport.left + viewport.width - 1) / 256);
  const lastTileY = Math.floor((viewport.top + viewport.height - 1) / 256);
  const tiles: Array<{ input: Buffer; left: number; top: number }> = [];
  await Promise.all(
    Array.from(
      { length: (lastTileX - firstTileX + 1) * (lastTileY - firstTileY + 1) },
      async (_, index) => {
        const columns = lastTileX - firstTileX + 1;
        const x = firstTileX + (index % columns);
        const y = firstTileY + Math.floor(index / columns);
        const tile = await fetchAerialTileWithRetry(gateway, {
          z: viewport.zoom,
          x,
          y,
        });
        tiles.push({
          input: Buffer.from(tile.bytes),
          left: (x - firstTileX) * 256,
          top: (y - firstTileY) * 256,
        });
      },
    ),
  );
  const mosaicWidth = (lastTileX - firstTileX + 1) * 256;
  const mosaicHeight = (lastTileY - firstTileY + 1) * 256;
  const mosaic = await sharp({
    create: {
      width: mosaicWidth,
      height: mosaicHeight,
      channels: 4,
      background: { r: 226, g: 232, b: 240, alpha: 1 },
    },
  })
    .composite(tiles)
    .png()
    .toBuffer();
  const cropped = await sharp(mosaic)
    .extract({
      left: viewport.left - firstTileX * 256,
      top: viewport.top - firstTileY * 256,
      width: viewport.width,
      height: viewport.height,
    })
    .ensureAlpha()
    .raw()
    .toBuffer();
  return new Uint8Array(cropped.buffer, cropped.byteOffset, cropped.byteLength);
}

async function fetchAerialTileWithRetry(
  gateway: AerialTileGateway,
  tile: AerialTileCoordinate,
) {
  try {
    return await gateway.fetchTile(tile);
  } catch {
    return gateway.fetchTile(tile);
  }
}
