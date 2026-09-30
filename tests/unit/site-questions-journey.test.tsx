import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PropertyCheckJourney } from "@/components/property-check-journey";
import type { FastPoolPlacementSnapshot } from "@/modules/data-access-spike/fast-pool-warning";

const saveAssessmentMock = vi.hoisted(() => vi.fn());
const scrollIntoViewMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/fast-property-view", () => ({
  FastPropertyView: ({
    result,
    onPlacementChange,
    onSnapshotReady,
    onConfirmPlacement,
    placementConfirmed,
    placementNextStep,
    planningStep,
    autoOpenMapLayersAfterDetailedChecks,
  }: {
    result: { resolvedAddress: { fullAddress: string } };
    onPlacementChange: (placement: FastPoolPlacementSnapshot) => void;
    onSnapshotReady: (snapshot: {
      imageDataUrl: string;
      visibleLayerKeys: string[];
    }) => void;
    onConfirmPlacement: () => void;
    placementConfirmed: boolean;
    placementNextStep?: "constraints" | "site-questions";
    planningStep?: React.ReactNode;
    autoOpenMapLayersAfterDetailedChecks?: boolean;
  }) => {
    function update(
      longitude: number,
      clearancesVisible: boolean,
      layoutId: "compact" | "family" | "custom" = "compact",
      layoutName: "Compact" | "Family" | "Custom" = "Compact",
      lengthMetres = 6.5,
      widthMetres = 3,
      emitSnapshot = true,
    ) {
      onPlacementChange({
        layoutId,
        layoutName,
        position: [longitude, -36.85],
        dimensions: { lengthMetres, widthMetres },
        rotationDegrees: 0,
        constructionEnvelopeWithinMappedArea: true,
        clearancesVisible,
      } as FastPoolPlacementSnapshot);
      if (emitSnapshot)
        onSnapshotReady({
          imageDataUrl: "data:image/png;base64,AAAA",
          visibleLayerKeys: [],
        });
    }
    return (
      <div>
        <h2 id="fast-view-heading" tabIndex={-1}>
          {result.resolvedAddress.fullAddress}
        </h2>
        <output data-testid="map-layers-auto-open">
          {String(autoOpenMapLayersAfterDetailedChecks)}
        </output>
        <button onClick={() => update(174.76, true)}>Set pool layout</button>
        <button
          onClick={() =>
            update(174.76, true, undefined, undefined, 6.5, 3, false)
          }
        >
          Place pool without snapshot
        </button>
        <button
          onClick={() =>
            onSnapshotReady({
              imageDataUrl: "data:image/png;base64,AAAA",
              visibleLayerKeys: [],
            })
          }
        >
          Provide map snapshot
        </button>
        <button onClick={() => update(174.76, true)}>
          Revisit pool layout
        </button>
        <button onClick={() => update(174.76, true, "family", "Family", 8, 4)}>
          Change named layout
        </button>
        <button
          onClick={() => update(174.76, true, "custom", "Custom", 7.2, 3.4)}
        >
          Change custom dimensions
        </button>
        <button onClick={() => update(174.76, false)}>Hide clearances</button>
        <button onClick={() => update(174.77, false)}>Move pool</button>
        {planningStep}
        <button onClick={onConfirmPlacement} disabled={placementConfirmed}>
          {placementNextStep === "site-questions"
            ? "Continue to site questions"
            : "Check for constraints"}
        </button>
      </div>
    );
  },
}));

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoViewMock,
  });
});

vi.mock("@/components/homeowner-submission-form", () => ({
  emptyHomeownerContactDraft: () => ({
    name: "",
    builderCompanyName: "",
    phone: "",
    email: "",
    desiredTiming: "asap",
    desiredTimingOtherDetail: "",
    additionalInfo: "",
    consentGiven: false,
  }),
  HomeownerSubmissionForm: ({
    assessmentSnapshot,
    reportAudience,
    draft,
    onDraftChange,
  }: {
    assessmentSnapshot: string;
    reportAudience: string;
    draft?: { name: string };
    onDraftChange?: (draft: { name: string }) => void;
  }) => (
    <div data-testid="details-form">
      <h3 id="homeowner-details-heading" tabIndex={-1}>
        Your details for the preliminary report
      </h3>
      Details for {assessmentSnapshot} as {reportAudience}
      <label>
        Name
        <input
          value={draft?.name ?? ""}
          onChange={(event) => onDraftChange?.({ name: event.target.value })}
        />
      </label>
    </div>
  ),
}));

vi.mock("@/components/saved-assessment-report-panel", () => ({
  SavedAssessmentReportPanel: () => null,
  useSavedAssessmentReport: () => ({
    assessment: null,
    showReport: false,
    resetReport: () => undefined,
    saveAssessment: saveAssessmentMock,
  }),
}));

vi.mock("@/modules/anonymous-funnel-analytics", () => ({
  trackAnonymousFunnelEvent: () => undefined,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  saveAssessmentMock.mockReset();
  scrollIntoViewMock.mockReset();
  Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});

describe("Site answers in the property journey", () => {
  it("checks homeowner constraints, returns to the address, and keeps pathway switching available", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", createJourneyFetch());

    render(<PropertyCheckJourney />);
    await openValidPlacement(user, "homeowner");

    await user.click(
      screen.getByRole("button", { name: "Check for constraints" }),
    );

    expect(
      screen.getByRole("button", { name: /Plan your pool.*Current/ }),
    ).toHaveAttribute("aria-current", "step");
    expect(
      screen.getByRole("button", { name: /Who is this for?.*Completed/ }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: /Find the property.*Completed/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Check for constraints" }),
    ).toBeDisabled();
    expect(
      await screen.findByRole("heading", { name: "Property details checked" }),
    ).toBeVisible();
    const addressHeading = screen.getByRole("heading", {
      name: "1 Test Street, Auckland",
    });
    await waitFor(() => expect(addressHeading).toHaveFocus());
    expect(scrollIntoViewMock).toHaveBeenLastCalledWith({
      behavior: "smooth",
      block: "start",
    });
    expect(scrollIntoViewMock.mock.instances.at(-1)).toBe(addressHeading);

    await continueToDetails(user);
    expect(await screen.findByTestId("details-form")).toBeVisible();
  });

  it("requires an audience choice before address search and exposes one gated journey", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", createJourneyFetch());

    render(<PropertyCheckJourney />);

    expect(
      screen.getByRole("navigation", { name: "Property Check journey" }),
    ).toBeVisible();
    expect(screen.getAllByRole("navigation")).toHaveLength(1);
    expect(
      screen.getByRole("radio", { name: "My property" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("radio", { name: "A customer property" }),
    ).not.toBeChecked();
    expect(
      screen.queryByLabelText("Auckland property address"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Find the property.*Locked/ }),
    ).toBeDisabled();

    screen.getByRole("radio", { name: "My property" }).focus();
    await user.keyboard(" ");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByLabelText("Auckland property address")).toBeVisible();
    expect(
      screen.getByRole("button", { name: /Who is this for?.*Completed/ }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: /Find the property.*Current/ }),
    ).toHaveAttribute("aria-current", "step");
  });

  it("takes homeowners from Plan your pool to details without technical inputs", async () => {
    const user = userEvent.setup();
    const fetchMock = createJourneyFetch();
    vi.stubGlobal("fetch", fetchMock);

    render(<PropertyCheckJourney />);
    expect(
      screen.queryByRole("slider", { name: "Estimated pool depth (m)" }),
    ).not.toBeInTheDocument();

    await openValidPlacement(user, "homeowner");
    expect(
      screen.queryByRole("slider", { name: "Estimated pool depth (m)" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Site questions")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Check for constraints" }),
    );
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([url]) => url.endsWith("/stages")),
      ).toHaveLength(2),
    );
    const homeownerDetailedRequest = (
      fetchMock.mock.calls as [string, RequestInit?][]
    )
      .filter(([url]) => url.endsWith("/stages"))
      .map(([, init]) => JSON.parse(String(init?.body)))
      .find((request) => request.mode === "detailed");
    expect(homeownerDetailedRequest).not.toHaveProperty("estimatedDepthMetres");
    expect(
      screen.getByRole("button", { name: /Who is this for?.*Completed/ }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: /Find the property.*Completed/ }),
    ).toBeDisabled();

    await continueToDetails(user);
    expect(await screen.findByTestId("details-form")).toHaveTextContent(
      "stage-token as homeowner",
    );
  });

  it("keeps homeowner details locked until the map snapshot is ready", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", createJourneyFetch());

    render(<PropertyCheckJourney />);
    await chooseAudienceAndOpenProperty(user, "homeowner");
    await enterPropertyAddress(user);
    await user.click(
      screen.getByRole("button", {
        name: "Place pool without snapshot",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Check for constraints" }),
    );

    const continueButton = await screen.findByRole("button", {
      name: "Continue to your details",
    });
    expect(continueButton).toBeDisabled();

    await user.click(
      screen.getByRole("button", { name: "Provide map snapshot" }),
    );
    expect(continueButton).toBeEnabled();
    await user.click(continueButton);
    expect(await screen.findByTestId("details-form")).toBeVisible();
  });

  it("visibly preselects the switchable builder pathway for builder entry", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", createJourneyFetch());

    render(<PropertyCheckJourney initialReportAudience="pool_builder" />);
    const builder = screen.getByRole("radio", {
      name: "A customer property",
    });
    expect(builder).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "My property" }));
    expect(builder).not.toBeChecked();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByLabelText("Auckland property address")).toBeVisible();
  });

  it("keeps the chosen builder depth permanently locked after checking constraints", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/property-check"))
        return Response.json({
          assessmentSnapshot: "initial-token",
          data: {
            resolvedAddress: {
              addressId: "address-1",
              fullAddress: "1 Test Street, Auckland",
              coordinates: [174.76, -36.85],
            },
            boundary: { state: "confirmed" },
          },
        });
      if (url.endsWith("/stages")) {
        const body = JSON.parse(String(init?.body));
        return Response.json({
          data: { status: "complete", layers: [], limitations: [] },
          assessmentSnapshot:
            body.mode === "detailed"
              ? `depth-${body.estimatedDepthMetres}`
              : "stage-token",
        });
      }
      return Response.json({ suggestions: [] });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<PropertyCheckJourney />);
    await openValidPlacement(user, "pool_builder");
    await user.click(
      screen.getByRole("button", { name: "Continue to site questions" }),
    );
    const depth = await screen.findByRole("slider", {
      name: "Estimated pool depth (m)",
    });
    fireEvent.change(depth, { target: { value: "1.9" } });
    await chooseNone(user);
    expect(await screen.findByText("Selected depth: 1.9 m")).toBeVisible();
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          url.endsWith("/stages") &&
          JSON.parse(String(init?.body)).estimatedDepthMetres === 1.9,
      ),
    ).toBe(true);
    expect(
      screen.queryByRole("slider", { name: "Estimated pool depth (m)" }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("map-layers-auto-open")).toHaveTextContent(
      "true",
    );
    expect(
      screen.queryByRole("button", { name: "Edit estimated depth" }),
    ).not.toBeInTheDocument();
  });

  it("unlocks builder depth after a failed constraints request and locks the successful retry", async () => {
    const user = userEvent.setup();
    const detailedDepths: number[] = [];
    let detailedAttempts = 0;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/property-check"))
        return Response.json({
          assessmentSnapshot: "initial-token",
          data: {
            resolvedAddress: {
              addressId: "address-1",
              fullAddress: "1 Test Street, Auckland",
              coordinates: [174.76, -36.85],
            },
            boundary: { state: "confirmed" },
          },
        });
      if (url.endsWith("/stages")) {
        const body = JSON.parse(String(init?.body));
        if (body.mode === "detailed") {
          detailedAttempts += 1;
          detailedDepths.push(body.estimatedDepthMetres);
          if (detailedAttempts === 1)
            return Response.json(
              {
                error: {
                  code: "UPSTREAM_UNAVAILABLE",
                  message: "Detailed constraints are temporarily unavailable.",
                },
              },
              { status: 503 },
            );
        }
        return Response.json({
          data: { status: "complete", layers: [], limitations: [] },
          assessmentSnapshot:
            body.mode === "detailed" ? "detailed-token" : "stage-token",
        });
      }
      if (url.endsWith("/site-answers"))
        return Response.json({
          assessmentSnapshot: "signed-stage-token",
          answers: {
            version: 1,
            estimatedDepthMetres: 2,
            route: { provenance: "uncertain", geometry: null },
            accessConditions: ["none_of_these"],
            nearbyFeatures: ["none_of_these"],
          },
        });
      return Response.json({ suggestions: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<PropertyCheckJourney />);
    await openValidPlacement(user, "pool_builder");
    await user.click(
      screen.getByRole("button", { name: "Continue to site questions" }),
    );
    const depth = await screen.findByRole("slider", {
      name: "Estimated pool depth (m)",
    });
    fireEvent.change(depth, { target: { value: "1.9" } });
    await chooseNone(user);

    expect(
      await screen.findByText(/couldn’t complete the property check/i),
    ).toBeVisible();
    const retryDepth = screen.getByRole("slider", {
      name: "Estimated pool depth (m)",
    });
    expect(retryDepth).toBeEnabled();

    fireEvent.change(retryDepth, { target: { value: "2" } });
    await user.click(
      screen.getByRole("button", { name: "Check for constraints" }),
    );

    await waitFor(() => {
      expect(detailedDepths).toEqual([1.9, 2]);
      expect(
        fetchMock.mock.calls.some(([url]) => url.endsWith("/site-answers")),
      ).toBe(true);
    });
    expect(await screen.findByText("Selected depth: 2.0 m")).toBeVisible();
    expect(
      screen.queryByRole("slider", { name: "Estimated pool depth (m)" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit estimated depth" }),
    ).not.toBeInTheDocument();
  });

  it("locks builder planning answers while the signed answer save completes", async () => {
    const user = userEvent.setup();
    let resolveSiteAnswers!: (response: Response) => void;
    const siteAnswersResponse = new Promise<Response>((resolve) => {
      resolveSiteAnswers = resolve;
    });
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/property-check"))
        return Response.json({
          assessmentSnapshot: "initial-token",
          data: {
            resolvedAddress: {
              addressId: "address-1",
              fullAddress: "1 Test Street, Auckland",
              coordinates: [174.76, -36.85],
            },
            boundary: { state: "confirmed" },
          },
        });
      if (url.endsWith("/stages"))
        return Response.json({
          data: { status: "complete", layers: [], limitations: [] },
          assessmentSnapshot: "stage-token",
        });
      if (url.endsWith("/site-answers")) return siteAnswersResponse;
      return Response.json({ suggestions: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<PropertyCheckJourney />);
    await openValidPlacement(user, "pool_builder");
    await user.click(
      screen.getByRole("button", { name: "Continue to site questions" }),
    );
    await openChoiceGroup(user, "Access and excavation conditions");
    const access = screen.getByRole("group", {
      name: "Which visible site conditions could affect plant access or excavation?",
    });
    await openChoiceGroup(user, "Nearby features");
    const nearby = screen.getByRole("group", {
      name: "Which existing features are close to the proposed pool area?",
    });
    await user.click(
      within(access).getByRole("checkbox", { name: "None of these" }),
    );
    await user.click(
      within(nearby).getByRole("checkbox", { name: "None of these" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Check for constraints" }),
    );
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) => url.endsWith("/site-answers")),
      ).toBe(true),
    );

    expect(
      screen.queryByRole("button", {
        name: "Access and excavation conditions",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Nearby features" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("slider", {
        name: "Indicative excavation side clearance",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Selected allowance: 300 mm each side"),
    ).toBeVisible();
    expect(within(access).queryByRole("checkbox")).not.toBeInTheDocument();
    expect(within(nearby).queryByRole("checkbox")).not.toBeInTheDocument();
    await act(async () => {
      resolveSiteAnswers(
        Response.json({
          assessmentSnapshot: "signed-stage-token",
          answers: {
            version: 1,
            estimatedDepthMetres: 1.5,
            route: { provenance: "uncertain", geometry: null },
            accessConditions: ["none_of_these"],
            nearbyFeatures: ["none_of_these"],
          },
        }),
      );
      await siteAnswersResponse;
    });

    expect(
      screen.getByRole("button", { name: "Continue to your details" }),
    ).toBeVisible();
  });

  it.each([
    ["homeowner", "pool_builder"],
    ["pool_builder", "homeowner"],
  ] as const)(
    "clears populated %s answers and results when switching to %s",
    async (fromAudience, toAudience) => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", createJourneyFetchWithSiteAnswers());

      render(<PropertyCheckJourney />);
      await openValidPlacement(user, fromAudience);
      await completePlanningCheck(user, fromAudience);
      expect(
        screen.getByRole("button", { name: "Continue to your details" }),
      ).toBeVisible();

      await user.click(
        screen.getByRole("button", { name: /Who is this for?.*Completed/ }),
      );
      await user.click(
        screen.getByRole("radio", {
          name:
            toAudience === "homeowner" ? "My property" : "A customer property",
        }),
      );
      await user.click(screen.getByRole("button", { name: "Continue" }));

      expect(screen.getByLabelText("Auckland property address")).toHaveValue(
        "",
      );
      expect(
        screen.queryByRole("heading", { name: "1 Test Street, Auckland" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Plan your pool.*Locked/ }),
      ).toBeDisabled();
      expect(
        screen.queryByRole("region", { name: "Access route result" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: "Property details checked" }),
      ).not.toBeInTheDocument();

      await enterPropertyAddress(user);
      await user.click(
        await screen.findByRole("button", { name: "Set pool layout" }),
      );
      await completePlanningCheck(user, toAudience);
      await continueToDetails(user);
      expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("");
    },
  );

  it("retries a failed site-answer save without rerunning detailed checks", async () => {
    const user = userEvent.setup();
    let siteAnswerAttempts = 0;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/property-check"))
        return Response.json({
          assessmentSnapshot: "initial-token",
          data: {
            resolvedAddress: {
              addressId: "address-1",
              fullAddress: "1 Test Street, Auckland",
              coordinates: [174.76, -36.85],
            },
            boundary: { state: "confirmed" },
          },
        });
      if (url.endsWith("/stages")) {
        const request = JSON.parse(String(init?.body));
        return Response.json({
          data: { status: "complete", layers: [], limitations: [] },
          assessmentSnapshot:
            request.mode === "detailed" ? "detailed-token" : "stage-token",
        });
      }
      if (url.endsWith("/site-answers")) {
        siteAnswerAttempts += 1;
        if (siteAnswerAttempts === 1)
          return Response.json(
            { error: { code: "TEMPORARY_FAILURE" } },
            { status: 503 },
          );
        return Response.json({
          assessmentSnapshot: "signed-detailed-token",
          answers: {
            version: 1,
            estimatedDepthMetres: 1.5,
            route: { provenance: "uncertain", geometry: null },
            accessConditions: ["none_of_these"],
            nearbyFeatures: ["none_of_these"],
          },
        });
      }
      return Response.json({ suggestions: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<PropertyCheckJourney />);
    await openValidPlacement(user, "pool_builder");
    await user.click(
      screen.getByRole("button", { name: "Continue to site questions" }),
    );
    await chooseNone(user);

    expect(
      await screen.findByText(/couldn’t complete the property check/i),
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Save builder answers" }),
    );
    await continueToDetails(user);
    expect(await screen.findByTestId("details-form")).toHaveTextContent(
      "signed-detailed-token",
    );

    const detailedRequests = fetchMock.mock.calls.filter(([url, init]) => {
      if (!url.endsWith("/stages")) return false;
      return JSON.parse(String(init?.body)).mode === "detailed";
    });
    expect(detailedRequests).toHaveLength(1);
    expect(siteAnswerAttempts).toBe(2);
  });
});

async function chooseNone(user: ReturnType<typeof userEvent.setup>) {
  await openChoiceGroup(user, "Access and excavation conditions");
  const access = screen.getByRole("group", {
    name: "Which visible site conditions could affect plant access or excavation?",
  });
  await openChoiceGroup(user, "Nearby features");
  const nearby = screen.getByRole("group", {
    name: "Which existing features are close to the proposed pool area?",
  });
  await user.click(
    within(access).getByRole("checkbox", { name: "None of these" }),
  );
  await user.click(
    within(nearby).getByRole("checkbox", { name: "None of these" }),
  );
  await user.click(
    screen.getByRole("button", {
      name: /Check for constraints|Save builder answers/,
    }),
  );
}

async function continueToDetails(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole("button", { name: "Continue to your details" }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("heading", {
        name: "Your details for the preliminary report",
      }),
    ).toHaveFocus(),
  );
}

async function openChoiceGroup(
  user: ReturnType<typeof userEvent.setup>,
  name: "Access and excavation conditions" | "Nearby features",
) {
  const button = screen.getByRole("button", { name });
  if (button.getAttribute("aria-expanded") === "false")
    await user.click(button);
}

function createJourneyFetch() {
  return vi.fn(async (url: string, init?: RequestInit) => {
    void init;
    if (url.endsWith("/property-check"))
      return Response.json({
        assessmentSnapshot: "initial-token",
        data: {
          resolvedAddress: {
            addressId: "address-1",
            fullAddress: "1 Test Street, Auckland",
            coordinates: [174.76, -36.85],
          },
          boundary: { state: "confirmed" },
        },
      });
    if (url.endsWith("/stages"))
      return Response.json({
        data: { status: "complete", layers: [], limitations: [] },
        assessmentSnapshot: "stage-token",
      });
    return Response.json({ suggestions: [] });
  });
}

function createJourneyFetchWithSiteAnswers() {
  const fetchJourney = createJourneyFetch();

  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/site-answers")) {
      const answers = JSON.parse(String(init?.body));
      return Response.json({
        assessmentSnapshot: "signed-stage-token",
        answers: {
          version: 1,
          estimatedDepthMetres: 1.5,
          route: { provenance: "uncertain", geometry: null },
          accessConditions: answers.accessConditions,
          nearbyFeatures: answers.nearbyFeatures,
        },
      });
    }

    return fetchJourney(url, init);
  });
}

async function chooseAudienceAndOpenProperty(
  user: ReturnType<typeof userEvent.setup>,
  audience: "homeowner" | "pool_builder",
) {
  const audienceRadio = screen.getByRole("radio", {
    name: audience === "homeowner" ? "My property" : "A customer property",
  });
  if (!(audienceRadio as HTMLInputElement).checked)
    await user.click(audienceRadio);
  await user.click(screen.getByRole("button", { name: "Continue" }));
}

async function enterPropertyAddress(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    screen.getByLabelText("Auckland property address"),
    "1 Test Street, Auckland",
  );
  await user.keyboard("{Enter}");
}

async function completePlanningCheck(
  user: ReturnType<typeof userEvent.setup>,
  audience: "homeowner" | "pool_builder",
) {
  if (audience === "homeowner") {
    await user.click(
      screen.getByRole("button", { name: "Check for constraints" }),
    );
  } else {
    await user.click(
      screen.getByRole("button", { name: "Continue to site questions" }),
    );
    await chooseNone(user);
  }
}

async function openValidPlacement(
  user: ReturnType<typeof userEvent.setup>,
  audience: "homeowner" | "pool_builder" = "homeowner",
) {
  await chooseAudienceAndOpenProperty(user, audience);
  await enterPropertyAddress(user);
  await user.click(
    await screen.findByRole("button", { name: "Set pool layout" }),
  );
}
