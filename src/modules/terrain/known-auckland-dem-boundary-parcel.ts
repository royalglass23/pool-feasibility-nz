import type { Polygon } from "geojson";

export const KNOWN_AUCKLAND_DEM_BOUNDARY_PARCEL = {
  address: "1/2 Sheehan Road, Te Atatū South, Auckland",
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [174.642896517, -36.876173199094],
        [174.642671317, -36.876293849094],
        [174.642559617, -36.8762419990939],
        [174.642505117, -36.876216816094],
        [174.643052733, -36.8759231820939],
        [174.6431307, -36.876017049094],
        [174.64314865, -36.876038649094],
        [174.642896517, -36.876173199094],
      ],
    ],
  } satisfies Polygon,
} as const;
