import { describe, expect, it, vi } from "vitest";
import { inflateSync } from "node:zlib";
import sharp from "sharp";
import { isValidPngMapImageDataUrl } from "@/modules/reporting/map-image";
import { captureLinzAerialBackground } from "@/modules/providers/linz/capture-linz-aerial-background";

vi.mock("server-only", () => ({}));

import {
  renderTrustedAssessmentMap,
  trustedAssessmentMapViewport,
  type TrustedAssessmentMapInput,
} from "@/modules/reporting/trusted-assessment-map";

const boundary = {
  type: "Polygon" as const,
  coordinates: [
    [
      [174.75, -36.86],
      [174.77, -36.86],
      [174.77, -36.84],
      [174.75, -36.84],
      [174.75, -36.86],
    ],
  ],
};

describe("renderTrustedAssessmentMap", () => {
  it("renders the signed geometry as a valid 900 by 600 PNG", async () => {
    const map = await renderTrustedAssessmentMap({
      boundary,
      shell: {
        type: "Polygon",
        coordinates: [
          [
            [174.757, -36.854],
            [174.763, -36.854],
            [174.763, -36.846],
            [174.757, -36.846],
            [174.757, -36.854],
          ],
        ],
      },
      constructionEnvelope: {
        type: "Polygon",
        coordinates: [
          [
            [174.756, -36.855],
            [174.764, -36.855],
            [174.764, -36.845],
            [174.756, -36.845],
            [174.756, -36.855],
          ],
        ],
      },
      warning: "needs_checking",
    });

    expect(isValidPngMapImageDataUrl(map)).toBe(true);
    const png = Buffer.from(
      map.slice("data:image/png;base64,".length),
      "base64",
    );
    expect(png.readUInt32BE(16)).toBe(900);
    expect(png.readUInt32BE(20)).toBe(600);
    const imageDataLength = png.readUInt32BE(33);
    const imageData = inflateSync(png.subarray(41, 41 + imageDataLength));
    expect(imageData.includes(Buffer.from([249, 115, 22, 255]))).toBe(true);
  });

  it("composites aerial tiles with every report-allowed official layer", async () => {
    const tile = await sharp({
      create: {
        width: 256,
        height: 256,
        channels: 4,
        background: { r: 15, g: 25, b: 35, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
    const fetchTile = vi.fn(async () => ({
      bytes: new Uint8Array(tile),
      contentType: "image/png",
    }));

    const input: TrustedAssessmentMapInput = {
      boundary,
      shell: {
        type: "Polygon",
        coordinates: [
          [
            [174.757, -36.854],
            [174.763, -36.854],
            [174.763, -36.846],
            [174.757, -36.846],
            [174.757, -36.854],
          ],
        ],
      },
      constructionEnvelope: {
        type: "Polygon",
        coordinates: [
          [
            [174.756, -36.855],
            [174.764, -36.855],
            [174.764, -36.845],
            [174.756, -36.845],
            [174.756, -36.855],
          ],
        ],
      },
      warning: "needs_checking",
      layers: [
        {
          key: "electricity_feeder_lines",
          evidenceUse: "report_allowed",
          geometry: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: {},
                geometry: {
                  type: "LineString",
                  coordinates: [
                    [174.751, -36.851],
                    [174.769, -36.849],
                  ],
                },
              },
            ],
          },
        },
        {
          key: "wastewater_assets",
          evidenceUse: "internal_reference",
          geometry: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: {},
                geometry: {
                  type: "LineString",
                  coordinates: [
                    [174.751, -36.852],
                    [174.769, -36.852],
                  ],
                },
              },
            ],
          },
        },
      ],
    };
    const viewport = trustedAssessmentMapViewport(input);
    const aerialPixels = await captureLinzAerialBackground(viewport, {
      aerialTileGateway: { fetchTile },
    });
    const map = await renderTrustedAssessmentMap(input, {
      aerialPixels,
      viewport,
    });

    expect(fetchTile).toHaveBeenCalled();
    const png = Buffer.from(
      map.slice("data:image/png;base64,".length),
      "base64",
    );
    const imageDataLength = png.readUInt32BE(33);
    const imageData = inflateSync(png.subarray(41, 41 + imageDataLength));
    expect(imageData.includes(Buffer.from([15, 25, 35, 255]))).toBe(true);
    expect(imageData.includes(Buffer.from([202, 138, 4, 255]))).toBe(true);
    expect(imageData.includes(Buffer.from([124, 58, 237, 255]))).toBe(false);
  });

  it("preserves the aerial report after one transient tile failure", async () => {
    const tile = await sharp({
      create: {
        width: 256,
        height: 256,
        channels: 4,
        background: { r: 45, g: 55, b: 65, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
    let firstAttempt = true;
    const fetchTile = vi.fn(async () => {
      if (firstAttempt) {
        firstAttempt = false;
        throw new Error("TRANSIENT_TILE_FAILURE");
      }
      return {
        bytes: new Uint8Array(tile),
        contentType: "image/png",
      };
    });

    const input: TrustedAssessmentMapInput = {
      boundary,
      shell: boundary,
      constructionEnvelope: boundary,
      warning: "needs_checking",
    };
    const viewport = trustedAssessmentMapViewport(input);
    const aerialPixels = await captureLinzAerialBackground(viewport, {
      aerialTileGateway: { fetchTile },
    });
    const map = await renderTrustedAssessmentMap(input, {
      aerialPixels,
      viewport,
    });

    expect(isValidPngMapImageDataUrl(map)).toBe(true);
    const png = Buffer.from(
      map.slice("data:image/png;base64,".length),
      "base64",
    );
    const imageDataLength = png.readUInt32BE(33);
    const imageData = inflateSync(png.subarray(41, 41 + imageDataLength));
    expect(imageData.includes(Buffer.from([45, 55, 65, 255]))).toBe(true);
  });
});
