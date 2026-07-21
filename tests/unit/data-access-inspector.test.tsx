import { createDataAccessGateway } from "../fixtures/normalized-data-access";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataAccessInspector } from "@/app/data-access-inspector";
import { runDataAccessSpike } from "@/modules/data-access-spike/run-data-access-spike";

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
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveRequest = resolve;
        }),
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
    expect(screen.getByText("1. Resolving address")).toBeVisible();
    expect(screen.getByText("2. Confirming legal parcel")).toBeVisible();
    expect(screen.getByText("3. Loading aerial imagery")).toBeVisible();
    await user.click(pendingButton);
    expect(fetchMock).toHaveBeenCalledTimes(1);

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
    expect(screen.getAllByText("Lot 1 DP 576345")).toHaveLength(2);
    expect(screen.getByText("Dataset availability")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Pool scenario comparison" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Feasibility assessment" }),
    ).toBeVisible();
    expect(screen.getByText("Not scored")).toBeVisible();
    expect(screen.getByText("Indeterminate")).toBeVisible();
    expect(screen.getByText("Low data confidence")).toBeVisible();
    expect(
      screen.getByText(
        "Insufficient core data is available for a preliminary recommendation.",
      ),
    ).toBeVisible();
    expect(
      screen.getAllByText(
        /Required core data is unavailable: building_footprints/i,
      ),
    ).toHaveLength(2);
    expect(screen.getByText("No successfully placed range")).toBeVisible();
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

    await user.click(
      screen.getByRole("button", { name: "Download session assessment" }),
    );
    expect(createObjectUrl).toHaveBeenCalledWith(expect.any(Blob));
    expect(clickAnchor).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:property-data");
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

    expect(
      await screen.findByRole("heading", {
        name: "Constrained AI explanation",
      }),
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

    expect(await screen.findByText("Deterministic fallback")).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "Deterministic assessment explanation",
      }),
    ).toBeVisible();
    expect(
      screen.queryByText("Constrained AI narrative"),
    ).not.toBeInTheDocument();
  });

  it("submits staff preferences and renders the scenario comparison", async () => {
    const user = userEvent.setup();
    const result = await createResult();
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ data: result }, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<DataAccessInspector />);
    const sizeSelect = screen.getByLabelText(
      "Preferred pool size",
    ) as HTMLSelectElement;
    expect([...sizeSelect.options].map(({ value }) => value)).toEqual([
      "",
      "compact",
      "standard",
      "large",
    ]);
    await user.selectOptions(sizeSelect, "standard");
    await user.selectOptions(
      screen.getByLabelText("Preferred pool location"),
      "front",
    );
    await user.selectOptions(
      screen.getByLabelText("Front boundary direction"),
      "south",
    );
    await user.type(
      screen.getByLabelText("Auckland property address"),
      requestedAddress,
    );
    await user.click(
      screen.getByRole("button", { name: "Fetch property data" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Pool scenario comparison" }),
    ).toBeVisible();
    expect(JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)).toEqual({
      address: requestedAddress,
      frontageDirection: "south",
      preferredLocation: "front",
      preferredSize: "standard",
    });
    expect(screen.getByRole("heading", { name: "Compact" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Standard" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Large" })).toBeVisible();
  });

  it("shows mapped official layers with controls, provenance, and honest unavailable states", async () => {
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

    expect(await screen.findByText("Official map layers")).toBeVisible();
    expect(
      screen.getByRole("checkbox", { name: /NZ Building Outlines/i }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /Wastewater Pipes/i }),
    ).toBeChecked();
    expect(
      screen.getAllByText("Internal reference only").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Dataset vintage: 2026-06")).toBeVisible();
    expect(
      screen.getAllByText("Dataset vintage: not published").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Flood Plains: provider timed out")).toBeVisible();
  });

  it("requires the user to choose an ambiguous address before parcel resolution", async () => {
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
      .mockResolvedValueOnce(Response.json({ data: result }, { status: 200 }));
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
      await screen.findByRole("heading", {
        name: "Select the correct address",
      }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: requestedAddress }));

    expect(
      await screen.findByRole("heading", { name: requestedAddress }),
    ).toBeVisible();
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string)).toEqual({
      address: "Bahari Drive, Ranui, Auckland",
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
    const result = await createResult();
    result.datasets.aerial_imagery = {
      ...result.datasets.aerial_imagery,
      status: "error",
      evidenceUse: "unavailable",
      confidence: "unavailable",
      errorCode: "PROVIDER_REQUEST_FAILED",
    };
    const fetchMock = vi.fn(async () =>
      Response.json({ data: result }, { status: 200 }),
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

    await user.click(
      await screen.findByRole("button", { name: "Try imagery again" }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

async function createResult() {
  return runDataAccessSpike({
    requestedAddress,
    gateway: createDataAccessGateway(),
    now: () => new Date("2026-07-16T00:00:00.000Z"),
  });
}
