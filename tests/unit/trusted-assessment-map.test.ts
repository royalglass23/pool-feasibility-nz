import { describe, expect, it, vi } from "vitest";
import { inflateSync } from "node:zlib";
import sharp from "sharp";
import { isValidPngMapImageDataUrl } from "@/modules/reporting/map-image";
import { captureLinzAerialBackground } from "@/modules/providers/linz/capture-linz-aerial-background";
import parcelsFixture from "../fixtures/linz/42-bahari-parcels.json";

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
  it("uses the matched 900 by 600 report camera at the live-map projection scale", () => {
    const bahariBoundary = parcelsFixture["42A"].features[0]
      .geometry as typeof boundary;

    expect(
      trustedAssessmentMapViewport({
        boundary: bahariBoundary,
        shell: bahariBoundary,
        constructionEnvelope: bahariBoundary,
      }),
    ).toEqual({
      zoom: 21,
      left: 528_829_188,
      top: 327_643_503,
      width: 900,
      height: 600,
    });
  });

  it("crops the composed aerial mosaic to the requested viewport origin", async () => {
    const tilePixels = Buffer.alloc(256 * 256 * 4);
    for (let y = 0; y < 256; y += 1) {
      for (let x = 0; x < 256; x += 1) {
        const index = (y * 256 + x) * 4;
        tilePixels[index] = x;
        tilePixels[index + 1] = y;
        tilePixels[index + 2] = (x + y) % 256;
        tilePixels[index + 3] = 255;
      }
    }
    const tile = await sharp(tilePixels, {
      raw: { width: 256, height: 256, channels: 4 },
    })
      .png()
      .toBuffer();
    const viewport = {
      zoom: 21,
      left: 528_829_188,
      top: 327_643_502,
      width: 900,
      height: 600,
    };

    const aerialPixels = await captureLinzAerialBackground(viewport, {
      aerialTileGateway: {
        fetchTile: vi.fn(async () => ({
          bytes: new Uint8Array(tile),
          contentType: "image/png",
        })),
      },
    });

    expect(Array.from(aerialPixels.subarray(0, 4))).toEqual([
      viewport.left % 256,
      viewport.top % 256,
      (viewport.left + viewport.top) % 256,
      255,
    ]);
  });

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

  it("antialiases diagonal report geometry over the saved aerial image", async () => {
    const viewport = trustedAssessmentMapViewport({
      boundary,
      shell: boundary,
      constructionEnvelope: boundary,
    });
    const offscreenGeometry = {
      type: "Polygon" as const,
      coordinates: [
        [
          [0, 0],
          [0.001, 0],
          [0.001, 0.001],
          [0, 0],
        ],
      ],
    };
    const aerialPixels = new Uint8Array(900 * 600 * 4);
    for (let offset = 0; offset < aerialPixels.length; offset += 4) {
      aerialPixels.set([15, 25, 35, 255], offset);
    }

    const map = await renderTrustedAssessmentMap(
      {
        boundary: null,
        shell: offscreenGeometry,
        constructionEnvelope: offscreenGeometry,
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
        ],
      },
      { aerialPixels, viewport },
    );
    const { data } = await sharp(
      Buffer.from(map.slice("data:image/png;base64,".length), "base64"),
    )
      .raw()
      .toBuffer({ resolveWithObject: true });
    let partiallyBlendedEdgePixels = 0;
    for (let offset = 0; offset < data.length; offset += 4) {
      const [red, green, blue] = data.subarray(offset, offset + 3);
      const isBackground = red === 15 && green === 25 && blue === 35;
      const isSolidStroke = red === 202 && green === 138 && blue === 4;
      if (!isBackground && !isSolidStroke) partiallyBlendedEdgePixels += 1;
    }

    expect(partiallyBlendedEdgePixels).toBeGreaterThan(100);
  });

  it("renders report-allowed contour lines with the report dash pattern", async () => {
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
      layers: [
        {
          key: "contours",
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
                    [174.751, -36.842],
                    [174.769, -36.842],
                  ],
                },
              },
            ],
          },
        },
      ],
    });

    const png = Buffer.from(
      map.slice("data:image/png;base64,".length),
      "base64",
    );
    const imageDataLength = png.readUInt32BE(33);
    const imageData = inflateSync(png.subarray(41, 41 + imageDataLength));
    let visibleContourPixels = 0;
    for (let offset = 1; offset < imageData.length; offset += 4) {
      const [red, green, blue] = imageData.subarray(offset, offset + 3);
      if (
        Math.abs(red - 71) <= 10 &&
        Math.abs(green - 85) <= 10 &&
        Math.abs(blue - 105) <= 10
      ) {
        visibleContourPixels += 1;
      }
    }
    expect(visibleContourPixels).toBeGreaterThan(100);
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
