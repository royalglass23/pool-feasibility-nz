import { expect, test } from "@playwright/test";
import providerFixtures from "../fixtures/providers/official-property-layers.json";

const address = "42A Bahari Drive, Ranui, Auckland";

test("selects the exact address, prevents duplicate work, maps the parcel, and downloads the result", async ({
  page,
}) => {
  await stubAerialTiles(page);
  const submittedBodies: unknown[] = [];
  await page.route("**/api/internal/data-access", async (route) => {
    const body = route.request().postDataJSON();
    submittedBodies.push(body);
    if (!body.selectedAddressId) {
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "ADDRESS_AMBIGUOUS",
            message: "Select the correct Auckland address to continue.",
            options: [
              {
                addressId: "969138",
                fullAddress: "42 Bahari Drive, Ranui, Auckland",
              },
              { addressId: "2359811", fullAddress: address },
            ],
          },
        }),
      });
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: dataAccessResult }),
    });
  });

  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Inspect official property data before assessing pool feasibility.",
    }),
  ).toBeVisible();

  await page
    .getByLabel("Auckland property address")
    .fill("Bahari Drive, Ranui, Auckland");
  await page.getByRole("button", { name: "Fetch property data" }).click();
  await page.getByRole("button", { name: address }).click();

  await expect(
    page.getByRole("button", { name: "Fetching official data…" }),
  ).toBeDisabled();
  await expect(page.getByText("1. Resolving address")).toBeVisible();
  await expect(page.getByText("3. Loading aerial imagery")).toBeVisible();

  await expect(page.getByRole("heading", { name: address })).toBeVisible();
  await expect(page.getByText("Parcel 8545868", { exact: true })).toBeVisible();
  await expect(page.getByText("NZ Addresses")).toBeVisible();
  await expect(
    page.getByRole("region", { name: `Aerial map for ${address}` }),
  ).toBeVisible();
  await expect(page.getByText("Official map layers")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Pool scenario comparison" }),
  ).toBeVisible();
  await expect(page.getByText("5m x 3m to 9m x 4m")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Compact", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Standard", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Large", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Compact candidate 1")).toBeVisible();
  await expect(
    page.getByText(
      "Screening evidence only - no candidate is an approved design or pool position.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "NZ Building Outlines" }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Wastewater Pipes" }),
  ).toBeChecked();
  for (const dataset of requiredMappedDatasetNames) {
    await expect(
      page.getByRole("checkbox", { name: dataset, exact: true }),
    ).toBeChecked();
  }
  await expect(
    page.getByText("Dataset vintage: not published").first(),
  ).toBeVisible();
  await expect(page.getByText("Internal reference only").first()).toBeVisible();
  await page.getByRole("checkbox", { name: "NZ Building Outlines" }).click();
  await expect(
    page.getByRole("checkbox", { name: "NZ Building Outlines" }),
  ).not.toBeChecked();
  await expect(
    page.getByText("Flood Plains: provider timed out"),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "© CC BY 4.0 LINZ" }).first(),
  ).toBeVisible();
  expect(submittedBodies).toEqual([
    { address: "Bahari Drive, Ranui, Auckland" },
    {
      address: "Bahari Drive, Ranui, Auckland",
      selectedAddressId: "2359811",
    },
  ]);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("property-data-2359811.json");
});

test("compares configured scenarios with staff size and location preferences", async ({
  page,
}) => {
  let submittedBody: Record<string, unknown> | undefined;
  await page.route("**/api/internal/data-access", async (route) => {
    submittedBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          ...dataAccessResult,
          scenarioComparison: {
            ...dataAccessResult.scenarioComparison,
            preferences: {
              preferredLocation: "north",
              preferredSize: "standard",
            },
            rankedScenarioIds: [
              "standard",
              "compact-plus",
              "standard-plus",
              "compact",
              "large",
            ],
          },
        },
      }),
    });
  });

  await page.goto("/");
  await page.getByLabel("Preferred pool size").selectOption("standard");
  await page.getByLabel("Preferred pool location").selectOption("north");
  await page.getByLabel("Auckland property address").fill(address);
  await page.getByRole("button", { name: "Fetch property data" }).click();

  const comparison = page.getByRole("region", {
    name: "Pool scenario comparison",
  });
  await expect(comparison).toBeVisible();
  await expect(comparison.getByText("5m x 3m to 9m x 4m")).toBeVisible();
  await expect(comparison.getByText("Preferred Size")).toBeVisible();
  await expect(
    comparison.getByText("Standard", { exact: true }).first(),
  ).toBeVisible();
  await expect(comparison.getByText("North", { exact: true })).toBeVisible();
  await expect(
    comparison.getByText("Configured intermediate").first(),
  ).toBeVisible();
  await expect(
    comparison.getByText("Specialist Review Required"),
  ).toBeVisible();
  await expect(comparison.getByRole("heading").nth(1)).toHaveText("Standard");
  expect(submittedBody).toEqual({
    address,
    preferredLocation: "north",
    preferredSize: "standard",
  });
});

test("retries after a controlled provider failure", async ({ page }) => {
  await stubAerialTiles(page);
  let attempts = 0;
  await page.route("**/api/internal/data-access", async (route) => {
    attempts += 1;
    await route.fulfill({
      status: attempts === 1 ? 502 : 200,
      contentType: "application/json",
      body: JSON.stringify(
        attempts === 1
          ? {
              error: {
                code: "DATA_PROVIDER_ERROR",
                message:
                  "An official data provider could not complete the request. Try again shortly.",
              },
            }
          : { data: dataAccessResult },
      ),
    });
  });

  await page.goto("/");
  await page.getByLabel("Auckland property address").fill(address);
  await page.getByRole("button", { name: "Fetch property data" }).click();
  await page.getByRole("button", { name: "Try again" }).click();

  await expect(page.getByRole("heading", { name: address })).toBeVisible();
  expect(attempts).toBe(2);
});

test("shows the honest no-clear-candidate wording for a controlled screening result", async ({
  page,
}) => {
  await stubAerialTiles(page);
  await page.route("**/api/internal/data-access", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          ...dataAccessResult,
          scenarioComparison: {
            ...dataAccessResult.scenarioComparison,
            scenarios: dataAccessResult.scenarioComparison.scenarios.map(
              (scenario) => ({
                ...scenario,
                status: "no_clear_candidate",
                candidates: [],
              }),
            ),
            successfulShells: [],
            shellRange: null,
          },
        },
      }),
    });
  });

  await page.goto("/");
  await page.getByLabel("Auckland property address").fill(address);
  await page.getByRole("button", { name: "Fetch property data" }).click();

  await expect(
    page
      .getByText("No successful candidate geometry supports this shell size.")
      .first(),
  ).toBeVisible();
  await expect(
    page.getByText("No Clear Candidate", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText(/pool impossible/i)).toHaveCount(0);
});

test("revokes verified imagery and retries when a LINZ tile fails", async ({
  page,
}) => {
  await page.route("**/api/internal/aerial/tiles/**", async (route) => {
    await route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "AERIAL_PROVIDER_ERROR",
          message: "LINZ aerial imagery could not complete the request.",
        },
      }),
    });
  });
  let attempts = 0;
  await page.route("**/api/internal/data-access", async (route) => {
    attempts += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: dataAccessResult }),
    });
  });

  await page.goto("/");
  await page.getByLabel("Auckland property address").fill(address);
  await page.getByRole("button", { name: "Fetch property data" }).click();

  await expect(page.getByText("Imagery unavailable")).toBeVisible();
  const retry = page.getByRole("button", { name: "Try imagery again" });
  await expect(retry).toBeVisible();
  await retry.click();
  await expect.poll(() => attempts).toBe(2);
});

async function stubAerialTiles(page: import("@playwright/test").Page) {
  await page.route("**/api/internal/aerial/tiles/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  });
}

const requiredMappedDatasetNames = [
  "NZ Building Outlines",
  "Contours 2016 - 0.25 metre contours",
  "Unitary Plan Base Zone",
  "Significant Ecological Areas Overlay (representative overlay spike)",
  "Flood Prone Areas",
  "Overland Flow Paths",
  "Stormwater Pipe",
  "Stormwater Manhole and Chamber",
  "Stormwater Catchpit",
  "Stormwater Watercourse",
  "Wastewater Pipes",
  "Water Pipes",
  "Wastewater Manholes",
  "Water Fittings",
  "Wastewater Fittings",
] as const;

type ProviderFixtureKey = keyof typeof providerFixtures;

function mappedFixtureEvidence(input: {
  key: ProviderFixtureKey;
  provider: "LINZ" | "Auckland Council" | "Watercare";
  dataset: string;
  datasetDate?: string;
}) {
  const evidenceUse =
    input.provider === "LINZ"
      ? "report_allowed"
      : input.provider === "Watercare"
        ? "internal_reference"
        : "spike_only";
  const attribution =
    input.provider === "LINZ"
      ? {
          text: "Land Information New Zealand (LINZ), CC BY 4.0",
          url: "https://www.linz.govt.nz/products-services/data/licensing-and-using-data",
        }
      : input.provider === "Watercare"
        ? {
            text: "Watercare Services Limited, CC BY-NC-ND 3.0 NZ",
            url: "https://www.watercare.co.nz/builders-and-developers/tools-fees-and-resources/gis-maps",
          }
        : {
            text: "Auckland Council geospatial data",
            url: "https://www.aucklandcouncil.govt.nz/geospatial/Pages/geospatial-terms-conditions.aspx",
          };
  const geometry = providerFixtures[input.key];

  return {
    provider: input.provider,
    dataset: input.dataset,
    status: "success",
    licenceStatus: input.provider === "LINZ" ? "permitted" : "conditional",
    evidenceUse,
    featureCount: geometry.features.length,
    datasetDate: input.datasetDate ?? null,
    attribution,
    geometry,
  };
}

const mappedFixtureDatasets = {
  building_footprints: mappedFixtureEvidence({
    key: "building_footprints",
    provider: "LINZ",
    dataset: "NZ Building Outlines",
    datasetDate: "2026-06",
  }),
  contours: mappedFixtureEvidence({
    key: "contours",
    provider: "Auckland Council",
    dataset: "Contours 2016 - 0.25 metre contours",
    datasetDate: "2016",
  }),
  planning_zone: mappedFixtureEvidence({
    key: "planning_zone",
    provider: "Auckland Council",
    dataset: "Unitary Plan Base Zone",
  }),
  planning_overlays: mappedFixtureEvidence({
    key: "planning_overlays",
    provider: "Auckland Council",
    dataset:
      "Significant Ecological Areas Overlay (representative overlay spike)",
  }),
  flood_prone_areas: mappedFixtureEvidence({
    key: "flood_prone_areas",
    provider: "Auckland Council",
    dataset: "Flood Prone Areas",
  }),
  overland_flow_paths: mappedFixtureEvidence({
    key: "overland_flow_paths",
    provider: "Auckland Council",
    dataset: "Overland Flow Paths",
  }),
  public_stormwater_assets: mappedFixtureEvidence({
    key: "public_stormwater_assets",
    provider: "Auckland Council",
    dataset: "Stormwater Pipe",
  }),
  manholes: mappedFixtureEvidence({
    key: "manholes",
    provider: "Auckland Council",
    dataset: "Stormwater Manhole and Chamber",
  }),
  catchpits: mappedFixtureEvidence({
    key: "catchpits",
    provider: "Auckland Council",
    dataset: "Stormwater Catchpit",
  }),
  watercourses: mappedFixtureEvidence({
    key: "watercourses",
    provider: "Auckland Council",
    dataset: "Stormwater Watercourse",
  }),
  wastewater_assets: mappedFixtureEvidence({
    key: "wastewater_assets",
    provider: "Watercare",
    dataset: "Wastewater Pipes",
  }),
  public_water_assets: mappedFixtureEvidence({
    key: "public_water_assets",
    provider: "Watercare",
    dataset: "Water Pipes",
  }),
  wastewater_manholes: mappedFixtureEvidence({
    key: "wastewater_manholes",
    provider: "Watercare",
    dataset: "Wastewater Manholes",
  }),
  water_fittings: mappedFixtureEvidence({
    key: "water_fittings",
    provider: "Watercare",
    dataset: "Water Fittings",
  }),
  wastewater_fittings: mappedFixtureEvidence({
    key: "wastewater_fittings",
    provider: "Watercare",
    dataset: "Wastewater Fittings",
  }),
};

const dataAccessResult = {
  requestedAddress: address,
  resolvedAddress: {
    addressId: "2359811",
    fullAddress: address,
    fullAddressNumber: "42A",
    unit: null,
    coordinates: [174.607906917203, -36.8602038189915],
  },
  addressAlternatives: [],
  parcel: {
    parcelId: "8545868",
    appellation: "Lot 1 DP 576345",
    parcelIntent: "Fee Simple Title",
    landDistrict: "North Auckland",
    titles: ["1060427"],
    surveyAreaSquareMetres: 245,
    calculatedAreaSquareMetres: 246,
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [174.6078, -36.8603],
          [174.608, -36.8603],
          [174.608, -36.8601],
          [174.6078, -36.8601],
          [174.6078, -36.8603],
        ],
      ],
    },
  },
  parcelMatch: { status: "mapped_primary_parcel", reasons: [] },
  comparisonParcels: [],
  identityCheck: {
    exactAddressMatched: true,
    distinctFromAlternatives: true,
    duplicateParcelRowsRemoved: 1,
  },
  datasets: {
    ...mappedFixtureDatasets,
    address_resolution: {
      provider: "LINZ",
      dataset: "NZ Addresses",
      status: "success",
      licenceStatus: "permitted",
      evidenceUse: "report_allowed",
      featureCount: 1,
    },
    aerial_imagery: {
      provider: "LINZ",
      dataset: "LINZ Basemaps Aerial",
      status: "available",
      licenceStatus: "permitted",
      evidenceUse: "spike_only",
      durationMs: 10,
      attribution: {
        text: "© CC BY 4.0 LINZ",
        url: "https://www.linz.govt.nz/data/linz-data/linz-basemaps/data-attribution",
      },
    },
    flood_plains: {
      provider: "Auckland Council",
      dataset: "Flood Plains",
      status: "error",
      licenceStatus: "conditional",
      evidenceUse: "unavailable",
      confidence: "unavailable",
      errorCode: "PROVIDER_TIMEOUT",
      attribution: {
        text: "Auckland Council geospatial data",
        url: "https://www.aucklandcouncil.govt.nz/geospatial/Pages/geospatial-terms-conditions.aspx",
      },
    },
  },
  successfulDatasets: [
    "address_resolution",
    ...Object.keys(mappedFixtureDatasets),
  ],
  unavailableDatasets: ["flood_plains"],
  reportEligibleDatasets: ["address_resolution", "building_footprints"],
  spikeOnlyDatasets: [
    "aerial_imagery",
    "contours",
    "planning_zone",
    "planning_overlays",
    "flood_prone_areas",
    "overland_flow_paths",
    "public_stormwater_assets",
    "manholes",
    "catchpits",
    "watercourses",
  ],
  internalReferenceDatasets: [
    "wastewater_assets",
    "public_water_assets",
    "wastewater_manholes",
    "water_fittings",
    "wastewater_fittings",
  ],
  providerErrors: [{ dataset: "flood_plains", code: "PROVIDER_TIMEOUT" }],
  scenarioComparison: comparisonFixture(),
  generatedAt: "2026-07-16T00:00:00.000Z",
  blockers: [
    "Watercare geometry is internal reference data only and must be independently verified before action",
  ],
};

function comparisonFixture() {
  const definitions = [
    ["compact", "Compact", "anchor", 5, 3],
    ["compact-plus", "Compact Plus", "intermediate", 6, 3.25],
    ["standard", "Standard", "anchor", 7, 3.5],
    ["standard-plus", "Standard Plus", "intermediate", 8, 3.75],
    ["large", "Large", "anchor", 9, 4],
  ] as const;
  const scenarios = definitions.map(
    ([id, label, kind, shellLengthMetres, shellWidthMetres], index) => {
      const candidate = {
        ...compactCandidate(
          1,
          [174.607955 - index * 0.00001, -36.86013 - index * 0.000005],
          index % 2 === 0 ? 0 : 90,
          2.4 + index,
        ),
        id: `${id}-1`,
      };
      return {
        scenario: {
          id,
          label,
          kind,
          version: "pool-scenario-comparison-v1",
          shellLengthMetres,
          shellWidthMetres,
          constructionAllowanceMetres: 1,
          rotationsDegrees: [0, 45, 90, 135],
          placementSpacingMetres: 0.5,
          maximumTestedPlacements: 4_000,
          maximumCandidates: 3,
        },
        status:
          index === 4
            ? "specialist_review_required"
            : "possible_with_constraints",
        resultWording: `${label} was tested against controlled mapped geometry.`,
        testedPlacementCount: 84,
        testedRotationsDegrees: [0, 45, 90, 135],
        usableAreaSquareMetres: 118.6,
        analysisEvidence: {
          parcel: fixtureSpatialEvidence(
            "legal_parcel",
            "NZ Primary Parcels",
            "LINZ",
          ),
          buildings: fixtureSpatialEvidence(
            "building_footprints",
            "NZ Building Outlines",
            "LINZ",
          ),
        },
        candidates: [candidate],
        missingRequiredEvidence: [],
      };
    },
  );
  const successfulShells = scenarios.map((analysis) => ({
    scenarioId: analysis.scenario.id,
    label: analysis.scenario.label,
    lengthMetres: analysis.scenario.shellLengthMetres,
    widthMetres: analysis.scenario.shellWidthMetres,
    candidateId: analysis.candidates[0].id,
  }));
  return {
    version: "pool-scenario-comparison-v1",
    preferences: { preferredLocation: "any", preferredSize: null },
    scenarios,
    rankedScenarioIds: definitions.map(([id]) => id),
    successfulShells,
    shellRange: {
      minimum: {
        scenarioId: "compact",
        lengthMetres: 5,
        widthMetres: 3,
        candidateId: "compact-1",
      },
      maximum: {
        scenarioId: "large",
        lengthMetres: 9,
        widthMetres: 4,
        candidateId: "large-1",
      },
    },
  };
}

function compactCandidate(
  rank: number,
  centre: [number, number],
  rotationDegrees: number,
  nearestServiceMetres: number,
) {
  return {
    id: `compact-${rank}`,
    rank,
    centre,
    rotationDegrees,
    shell: fixtureRectangle(centre, 0.000028, 0.0000135),
    envelope: fixtureRectangle(centre, 0.000039, 0.0000225),
    placementEvidence: {
      parcel: fixtureSpatialEvidence(
        "legal_parcel",
        "NZ Primary Parcels",
        "LINZ",
      ),
      buildings: fixtureSpatialEvidence(
        "building_footprints",
        "NZ Building Outlines",
        "LINZ",
      ),
    },
    constraintIntersections: [
      {
        evidence: fixtureSpatialEvidence(
          "flood_prone_areas",
          "Flood Prone Areas",
          "Auckland Council",
        ),
        status: "measured",
        intersects: false,
        affectedEnvelopePercent: null,
      },
    ],
    mappedServiceDistances: [
      {
        evidence: fixtureSpatialEvidence(
          "wastewater_assets",
          "Wastewater Pipes",
          "Watercare",
        ),
        status: "measured",
        distanceMetres: nearestServiceMetres,
      },
    ],
    rankingEvidence: [
      "Entire indicative construction envelope is inside the mapped parcel.",
      "Envelope does not intersect a known LINZ building footprint.",
      `Nearest mapped service is approximately ${nearestServiceMetres.toFixed(1)} m from the indicative construction envelope.`,
    ],
  };
}

function fixtureSpatialEvidence(id: string, label: string, provider: string) {
  return {
    id,
    label,
    status: "available",
    provenance: {
      provider,
      dataset: label,
      datasetIdentifier: `fixture:${id}`,
      retrievedAt: "2026-07-16T00:00:00.000Z",
      datasetDate: null,
      licence: "Controlled test fixture",
      attribution: null,
      geometryUsed: "controlled fixture geometry",
      attributesUsed: [],
      evidenceType: "controlled_fixture",
      confidence: "high",
    },
  };
}

function fixtureRectangle(
  [longitude, latitude]: [number, number],
  halfLongitude: number,
  halfLatitude: number,
) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "Polygon" as const,
      coordinates: [
        [
          [longitude - halfLongitude, latitude - halfLatitude],
          [longitude + halfLongitude, latitude - halfLatitude],
          [longitude + halfLongitude, latitude + halfLatitude],
          [longitude - halfLongitude, latitude + halfLatitude],
          [longitude - halfLongitude, latitude - halfLatitude],
        ],
      ],
    },
  };
}
