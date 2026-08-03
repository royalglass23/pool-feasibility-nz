import { createDataAccessGateway } from "../fixtures/normalized-data-access";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataAccessInspector } from "@/app/data-access-inspector";
import { runDataAccessSpike } from "@/modules/data-access-spike/run-data-access-spike";
import { runFastPropertyView } from "@/modules/data-access-spike/fast-property-view";

const requestedAddress = "42A Bahari Drive, Ranui, Auckland";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("DataAccessInspector", { timeout: 10_000 }, () => {
  it("starts empty and prevents duplicate requests while loading", async () => {
    const user = userEvent.setup();
    let resolveRequest: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === "POST"
        ? new Promise<Response>((resolve) => {
            resolveRequest = resolve;
          })
        : Promise.resolve(Response.json({ suggestions: [] }, { status: 200 })),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<DataAccessInspector />);

    const input = screen.getByLabelText("Auckland property address");
    expect(input).toHaveValue("");

    await user.type(input, requestedAddress);
    await user.click(
      screen.getByRole("button", { name: "Fetch property data" }),
    );

    const pendingButton = screen.getByRole("button", {
      name: "Fetching official data…",
    });
    expect(pendingButton).toBeDisabled();
    expect(screen.getByText("Address found")).toBeVisible();
    await user.click(pendingButton);
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(1);

    resolveRequest?.(
      new Response(
        JSON.stringify({ error: { code: "STOP", message: "Stopped" } }),
        { status: 502 },
      ),
    );
    expect(await screen.findByText("Stopped")).toBeVisible();
  });

  it("renders normalized results and downloads the session assessment", async () => {
    const user = userEvent.setup();
    const result = await createResult();
    result.datasets.aerial_imagery.attribution = {
      text: "© Crown copyright: Eagle Technology, LINZ",
      url: "https://www.linz.govt.nz/data/linz-data/linz-basemaps/data-attribution",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ data: result }, { status: 200 })),
    );
    const createObjectUrl = vi.fn(() => "blob:property-data");
    const revokeObjectUrl = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrl,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectUrl,
    });
    const clickAnchor = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    render(<DataAccessInspector />);
    await user.type(
      screen.getByLabelText("Auckland property address"),
      requestedAddress,
    );
    await user.click(
      screen.getByRole("button", { name: "Fetch property data" }),
    );

    expect(
      await screen.findByRole("heading", { name: requestedAddress }),
    ).toBeVisible();
    expect(screen.getByText("Lot 1 DP 576345")).toBeVisible();
    expect(screen.getByText("Assessment details")).toBeVisible();
    expect(
      screen.getByText("Property map and official evidence"),
    ).toBeVisible();
    expect(screen.getByText("Assessment and scoring")).toBeVisible();
    expect(screen.getByText("Risks and actions")).toBeVisible();
    expect(screen.getByText("Sources and provenance")).toBeVisible();
    expect(screen.getByText("Limits and unknowns")).toBeVisible();
    await user.click(screen.getByText("Assessment and scoring"));
    expect(
      screen.getByRole("heading", { name: "Feasibility assessment" }),
    ).toBeVisible();
    expect(screen.getByText("Not scored")).toBeVisible();
    expect(screen.getByText("Indeterminate")).toBeVisible();
    expect(screen.getByText("Low data confidence")).toBeVisible();
    expect(
      screen.getAllByText(
        "Insufficient core data is available for a preliminary recommendation.",
      ),
    ).toHaveLength(2);
    expect(
      screen.getAllByText(
        /Required core data is unavailable: building_footprints/i,
      ),
    ).toHaveLength(2);
    expect(
      screen.getByRole("region", {
        name: `Aerial map for ${requestedAddress}`,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", {
        name: "© Crown copyright: Eagle Technology, LINZ",
      }),
    ).toHaveAttribute(
      "href",
      "https://www.linz.govt.nz/data/linz-data/linz-basemaps/data-attribution",
    );

    expect(
      screen.getByRole("button", { name: "Generate PDF report" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Assessment data" }));
    expect(createObjectUrl).toHaveBeenCalledWith(expect.any(Blob));
    expect(clickAnchor).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:property-data");
  });

  it("announces the confirmed legal parcel before the assessment details", async () => {
    const user = userEvent.setup();
    const result = await createResult();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ data: result }, { status: 200 })),
    );

    render(<DataAccessInspector />);
    await user.type(
      screen.getByLabelText("Auckland property address"),
      requestedAddress,
    );
    await user.click(
      screen.getByRole("button", { name: "Fetch property data" }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Legal parcel confirmed",
    );
    expect(screen.getByRole("status")).toHaveTextContent("Parcel 8545868");
  });

  it.each([
    ["confirmed", "nationwide", "Confirmed", "Nationwide"],
    ["provisional", "outside-region", "Provisional", "Outside Region"],
  ] as const)(
    "presents the %s boundary and %s regional coverage states",
    async (
      boundaryState,
      regionCoverageState,
      expectedBoundary,
      expectedCoverage,
    ) => {
      const user = userEvent.setup();
      const result = await createResult();
      result.boundaryState = boundaryState;
      result.regionCoverageState = regionCoverageState;
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => Response.json({ data: result }, { status: 200 })),
      );

      render(<DataAccessInspector />);
      await user.type(
        screen.getByLabelText("Auckland property address"),
        requestedAddress,
      );
      await user.click(
        screen.getByRole("button", { name: "Fetch property data" }),
      );

      expect(
        await screen.findByRole("heading", { name: requestedAddress }),
      ).toBeVisible();
      expect(
        screen.getByText(`Boundary state: ${expectedBoundary}`),
      ).toBeVisible();
      expect(
        screen.getByText(`Regional layer coverage: ${expectedCoverage}`),
      ).toBeVisible();
    },
  );

  it.each([
    ["multiple", "PARCEL_AMBIGUOUS", 409, "More than one mapped boundary"],
    ["unavailable", "PARCEL_NOT_FOUND", 404, "No mapped boundary was found"],
  ] as const)(
    "presents the %s boundary error state",
    async (boundaryState, code, status, message) => {
      const user = userEvent.setup();
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          Response.json(
            { error: { code, message, boundaryState } },
            { status },
          ),
        ),
      );

      render(<DataAccessInspector />);
      await user.type(
        screen.getByLabelText("Auckland property address"),
        requestedAddress,
      );
      await user.click(
        screen.getByRole("button", { name: "Fetch property data" }),
      );

      expect(await screen.findByText(message)).toBeVisible();
    },
  );

  it("announces when autocomplete has no matching addresses", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ suggestions: [] }, { status: 200 })),
    );

    render(<DataAccessInspector />);
    await user.type(
      screen.getByLabelText("Auckland property address"),
      "42A Bahari",
    );

    expect(
      await screen.findByText(
        "No matching New Zealand addresses were found yet.",
      ),
    ).toBeVisible();
  });

  it("announces autocomplete provider failure", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("provider unavailable");
      }),
    );

    render(<DataAccessInspector />);
    await user.type(
      screen.getByLabelText("Auckland property address"),
      "42A Bahari",
    );

    expect(
      await screen.findByText(
        "Address suggestions are temporarily unavailable.",
      ),
    ).toBeVisible();
  });

  it("shows the constrained AI explanation without presenting it as a calculation", async () => {
    const user = userEvent.setup();
    const result = await createResult();
    const data = {
      ...result,
      assessmentExplanation: {
        source: "ai" as const,
        heading: "Constrained AI explanation",
        paragraphs: [
          "Deterministic confidence is low at 42 out of 100.",
          "No pool shell size range was successfully placed with the available evidence.",
        ],
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ data }, { status: 200 })),
    );

    render(<DataAccessInspector />);
    await user.type(
      screen.getByLabelText("Auckland property address"),
      requestedAddress,
    );
    await user.click(
      screen.getByRole("button", { name: "Fetch property data" }),
    );

    await screen.findByRole("heading", { name: requestedAddress });
    await user.click(screen.getByText("Assessment and scoring"));
    expect(
      screen.getByRole("heading", { name: "Constrained AI explanation" }),
    ).toBeVisible();
    expect(screen.getByText("Constrained AI narrative")).toBeVisible();
    expect(
      screen.getByText(
        "AI does not calculate or change the deterministic score, confidence, critical flags, geometry, rankings, or size range.",
      ),
    ).toBeVisible();
    expect(
      screen.getByText(
        "No pool shell size range was successfully placed with the available evidence.",
      ),
    ).toBeVisible();
  });

  it("clearly labels deterministic explanation fallback", async () => {
    const user = userEvent.setup();
    const result = await createResult();
    const data = {
      ...result,
      assessmentExplanation: {
        source: "deterministic_fallback" as const,
        heading: "Deterministic assessment explanation",
        paragraphs: [
          "Insufficient core data is available for a preliminary recommendation.",
        ],
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ data }, { status: 200 })),
    );

    render(<DataAccessInspector />);
    await user.type(
      screen.getByLabelText("Auckland property address"),
      requestedAddress,
    );
    await user.click(
      screen.getByRole("button", { name: "Fetch property data" }),
    );

    await screen.findByRole("heading", { name: requestedAddress });
    await user.click(screen.getByText("Assessment and scoring"));
    expect(screen.getByText("Deterministic fallback")).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "Deterministic assessment explanation",
      }),
    ).toBeVisible();
    expect(
      screen.queryByText("Constrained AI narrative"),
    ).not.toBeInTheDocument();
  });

  it("requests only an address and renders a deterministic size recommendation", async () => {
    const user = userEvent.setup();
    const result = await createResult();
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ data: result }, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<DataAccessInspector />);
    expect(
      screen.queryByLabelText("Preferred pool size"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Preferred pool location"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Front boundary direction"),
    ).not.toBeInTheDocument();
    await user.type(
      screen.getByLabelText("Auckland property address"),
      requestedAddress,
    );
    await user.click(
      screen.getByRole("button", { name: "Fetch property data" }),
    );

    await screen.findByRole("heading", { name: requestedAddress });
    expect(JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)).toEqual({
      address: requestedAddress,
    });
    expect(
      screen.getByRole("heading", {
        name: "Place a pool concept on the selected property",
      }),
    ).toBeVisible();
  });

  it("summarises successful pool shells by count", async () => {
    const user = userEvent.setup();
    const result = await createResult();
    result.scenarioComparison.successfulShells =
      result.scenarioComparison.scenarios.map(({ scenario }, index) => ({
        scenarioId: scenario.id,
        label: scenario.label,
        lengthMetres: scenario.shellLengthMetres,
        widthMetres: scenario.shellWidthMetres,
        candidateId: `candidate-${index + 1}`,
      }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ data: result }, { status: 200 })),
    );

    render(<DataAccessInspector />);
    await user.type(
      screen.getByLabelText("Auckland property address"),
      requestedAddress,
    );
    await user.click(
      screen.getByRole("button", { name: "Fetch property data" }),
    );

    await screen.findByRole("heading", { name: requestedAddress });
    expect(
      screen.getByRole("heading", { name: "Manual pool placement" }),
    ).toBeVisible();
    expect(document.body).not.toHaveTextContent("[object Object]");
  });

  it("shows a focused utility legend", async () => {
    const user = userEvent.setup();
    const result = await createResult();
    result.datasets.building_footprints = {
      ...result.datasets.building_footprints,
      status: "success",
      featureCount: 1,
      datasetDate: "2026-06",
      geometry: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            id: "building-901",
            properties: { building_id: 901 },
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [174.60782, -36.86028],
                  [174.60796, -36.86028],
                  [174.60796, -36.86016],
                  [174.60782, -36.86016],
                  [174.60782, -36.86028],
                ],
              ],
            },
          },
        ],
      },
    };
    result.datasets.wastewater_assets = {
      ...result.datasets.wastewater_assets,
      status: "success",
      evidenceUse: "internal_reference",
      featureCount: 1,
      geometry: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            id: "ww-41",
            properties: { COMPKEY: 41 },
            geometry: {
              type: "LineString",
              coordinates: [
                [174.60779, -36.8603],
                [174.60801, -36.86011],
              ],
            },
          },
        ],
      },
    };
    result.datasets.flood_plains = {
      ...result.datasets.flood_plains,
      status: "error",
      evidenceUse: "unavailable",
      confidence: "unavailable",
      errorCode: "PROVIDER_TIMEOUT",
      geometry: undefined,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ data: result }, { status: 200 })),
    );

    render(<DataAccessInspector />);
    await user.type(
      screen.getByLabelText("Auckland property address"),
      requestedAddress,
    );
    await user.click(
      screen.getByRole("button", { name: "Fetch property data" }),
    );

    expect(await screen.findByText("Utility legend")).toBeVisible();
    expect(screen.getByLabelText("Map legend")).toHaveTextContent(
      "Wastewater Pipes",
    );
    const wastewaterLayer = screen.getByRole("checkbox", {
      name: "Wastewater Pipes",
    });
    expect(wastewaterLayer).toBeChecked();
    await user.click(wastewaterLayer);
    expect(wastewaterLayer).not.toBeChecked();
    expect(
      screen.getAllByText("Internal reference only").length,
    ).toBeGreaterThan(0);
  });

  it("requires the user to choose an ambiguous address before parcel resolution", async () => {
    const user = userEvent.setup();
    const result = await createResult();
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === "POST"
        ? fetchMock.mock.calls.filter(
            ([, requestInit]) => requestInit?.method === "POST",
          ).length === 1
          ? Promise.resolve(
              Response.json(
                {
                  error: {
                    code: "ADDRESS_AMBIGUOUS",
                    message: "Select the correct Auckland address to continue.",
                    options: [
                      {
                        addressId: "969138",
                        fullAddress: "42 Bahari Drive, Ranui, Auckland",
                      },
                      {
                        addressId: "2359811",
                        fullAddress: requestedAddress,
                      },
                    ],
                  },
                },
                { status: 409 },
              ),
            )
          : Promise.resolve(Response.json({ data: result }, { status: 200 }))
        : Promise.resolve(Response.json({ suggestions: [] }, { status: 200 })),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<DataAccessInspector />);
    await user.type(
      screen.getByLabelText("Auckland property address"),
      "Bahari Drive, Ranui, Auckland",
    );
    await user.click(
      screen.getByRole("button", { name: "Fetch property data" }),
    );

    expect(
      await screen.findByRole("option", { name: requestedAddress }),
    ).toBeVisible();
    expect(
      screen.getAllByRole("option", { name: requestedAddress }),
    ).toHaveLength(1);
    expect(
      screen.queryByRole("heading", { name: "Select the correct address" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: requestedAddress }));

    expect(
      await screen.findByRole("heading", { name: requestedAddress }),
    ).toBeVisible();
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string)).toEqual({
      address: "Bahari Drive, Ranui, Auckland",
      selectedAddressId: "2359811",
    });
  });

  it("lets the user select a LINZ address autocomplete suggestion", async () => {
    const user = userEvent.setup();
    const result = await createResult();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          suggestions: [
            {
              addressId: "2359811",
              fullAddress: requestedAddress,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(Response.json({ data: result }, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<DataAccessInspector />);
    const input = screen.getByLabelText("Auckland property address");
    await user.type(input, "42A Bahari");

    expect(
      await screen.findByRole("option", { name: requestedAddress }),
    ).toBeVisible();
    await user.click(screen.getByRole("option", { name: requestedAddress }));
    expect(input).toHaveValue(requestedAddress);

    expect(
      await screen.findByRole("heading", { name: requestedAddress }),
    ).toBeVisible();
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string)).toEqual({
      address: "42A Bahari",
      selectedAddressId: "2359811",
    });
  });

  it("preserves a post-submit address selection when retrying a provider failure", async () => {
    const user = userEvent.setup();
    const result = await createResult();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          {
            error: {
              code: "ADDRESS_AMBIGUOUS",
              message: "Select the correct Auckland address to continue.",
              options: [
                {
                  addressId: "2359811",
                  fullAddress: requestedAddress,
                },
              ],
            },
          },
          { status: 409 },
        ),
      )
      .mockResolvedValueOnce(
        Response.json(
          {
            error: {
              code: "DATA_PROVIDER_ERROR",
              message: "The provider is temporarily unavailable.",
            },
          },
          { status: 502 },
        ),
      )
      .mockResolvedValueOnce(Response.json({ data: result }, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<DataAccessInspector />);
    await user.type(
      screen.getByLabelText("Auckland property address"),
      requestedAddress,
    );
    await user.click(
      screen.getByRole("button", { name: "Fetch property data" }),
    );
    await user.click(screen.getByRole("option", { name: requestedAddress }));
    await user.click(await screen.findByRole("button", { name: "Try again" }));

    expect(
      await screen.findByRole("heading", { name: requestedAddress }),
    ).toBeVisible();
    expect(JSON.parse(fetchMock.mock.calls[2][1].body as string)).toEqual({
      address: requestedAddress,
      selectedAddressId: "2359811",
    });
  });

  it("retries the same address after a provider failure", async () => {
    const user = userEvent.setup();
    const result = await createResult();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          {
            error: {
              code: "DATA_PROVIDER_ERROR",
              message:
                "An official data provider could not complete the request. Try again shortly.",
            },
          },
          { status: 502 },
        ),
      )
      .mockResolvedValueOnce(Response.json({ data: result }, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<DataAccessInspector />);
    await user.type(
      screen.getByLabelText("Auckland property address"),
      requestedAddress,
    );
    await user.click(
      screen.getByRole("button", { name: "Fetch property data" }),
    );

    expect(
      await screen.findByRole("button", { name: "Try again" }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(
      await screen.findByRole("heading", { name: requestedAddress }),
    ).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries when the property resolves but LINZ imagery fails", async () => {
    const user = userEvent.setup();
    const fastResult = await runFastPropertyView({
      requestedAddress,
      gateway: createDataAccessGateway(),
      basemapApiKey: "test-key",
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/fast-property-view/stages")) {
        return Response.json({
          data: {
            boundary: fastResult.boundary,
            aerial: { state: "error" },
            progress: {
              address: "found",
              boundary: "found",
              aerial: "error",
              detailedChecks: "not_loaded",
            },
          },
          assessmentSnapshot: "server-issued-stage-snapshot",
        });
      }
      return Response.json(
        {
          data: fastResult,
          assessmentSnapshot: "server-issued-initial-snapshot",
        },
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<DataAccessInspector />);
    await user.type(
      screen.getByLabelText("Auckland property address"),
      requestedAddress,
    );
    await user.click(
      screen.getByRole("button", { name: "Fetch property data" }),
    );

    await screen.findByText(/Aerial imagery is not ready yet/);
    await user.click(screen.getByRole("button", { name: "Retry fast view" }));
    expect(
      fetchMock.mock.calls.filter(
        ([input]) => String(input) === "/api/internal/fast-property-view",
      ),
    ).toHaveLength(2);
  });

  it("shows a stage validation error instead of leaving the boundary pending", async () => {
    const user = userEvent.setup();
    const fastResult = await runFastPropertyView({
      requestedAddress,
      gateway: createDataAccessGateway(),
      basemapApiKey: "test-key",
    });
    const stageError =
      "The property assessment has expired or is invalid. Search for the address again.";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          { data: fastResult, assessmentSnapshot: "server-issued-snapshot" },
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        Response.json(
          { error: { code: "INVALID_REQUEST", message: stageError } },
          { status: 400 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<DataAccessInspector />);
    await user.type(
      screen.getByLabelText("Auckland property address"),
      requestedAddress,
    );
    await user.click(
      screen.getByRole("button", { name: "Fetch property data" }),
    );

    expect(await screen.findByText(stageError)).toBeVisible();
  });
});

async function createResult() {
  return runDataAccessSpike({
    requestedAddress,
    gateway: createDataAccessGateway(),
    now: () => new Date("2026-07-16T00:00:00.000Z"),
  });
}
