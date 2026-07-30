import { describe, expect, it, vi } from "vitest";
import { inflateSync } from "node:zlib";
import { isValidPngMapImageDataUrl } from "@/modules/reporting/map-image";

vi.mock("server-only", () => ({}));

import { renderTrustedAssessmentMap } from "@/modules/reporting/trusted-assessment-map";

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
});
