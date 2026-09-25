import { afterEach, describe, expect, it, vi } from "vitest";
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

vi.mock("@/components/fast-property-view", () => ({
  FastPropertyView: ({
    onPlacementChange,
    onSnapshotReady,
    onConfirmPlacement,
    placementConfirmed,
    planningStep,
  }: {
    onPlacementChange: (placement: FastPoolPlacementSnapshot) => void;
    onSnapshotReady: (snapshot: {
      imageDataUrl: string;
      visibleLayerKeys: string[];
    }) => void;
    onConfirmPlacement: () => void;
    placementConfirmed: boolean;
    planningStep?: React.ReactNode;
  }) => {
    function update(longitude: number, clearancesVisible: boolean) {
      onPlacementChange({
        position: [longitude, -36.85],
        dimensions: { lengthMetres: 6, widthMetres: 3 },
        rotationDegrees: 0,
        constructionEnvelopeWithinMappedArea: true,
        clearancesVisible,
      } as FastPoolPlacementSnapshot);
      onSnapshotReady({
        imageDataUrl: "data:image/png;base64,AAAA",
        visibleLayerKeys: [],
      });
    }
    return (
      <div>
        <button onClick={() => update(174.76, true)}>Set pool layout</button>
        <button onClick={() => update(174.76, false)}>Hide clearances</button>
        <button onClick={() => update(174.77, false)}>Move pool</button>
        {planningStep}
        <button onClick={onConfirmPlacement} disabled={placementConfirmed}>
          Use this pool position
        </button>
      </div>
    );
  },
}));

vi.mock("@/components/homeowner-submission-form", () => ({
  HomeownerSubmissionForm: ({
    assessmentSnapshot,
    reportAudience,
  }: {
    assessmentSnapshot: string;
    reportAudience: string;
  }) => (
    <div data-testid="details-form">
      Details for {assessmentSnapshot} as {reportAudience}
    </div>
  ),
}));

vi.mock("@/components/saved-assessment-report-panel", () => ({
  SavedAssessmentReportPanel: () => null,
  useSavedAssessmentReport: () => ({
    assessment: null,
    showReport: false,
    resetReport: () => undefined,
    saveAssessment: () => undefined,
  }),
}));

vi.mock("@/modules/anonymous-funnel-analytics", () => ({
  trackAnonymousFunnelEvent: () => undefined,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Site answers in the property journey", () => {
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

  it("takes homeowners from mapped checks to details without technical inputs", async () => {
    const user = userEvent.setup();
    const fetchMock = createJourneyFetch();
    vi.stubGlobal("fetch", fetchMock);

    render(<PropertyCheckJourney />);
    const homeowner = screen.getByRole("radio", { name: "My property" });
    const builder = screen.getByRole("radio", {
      name: "A customer property",
    });
    expect(homeowner).not.toBeChecked();
    expect(builder).not.toBeChecked();
    expect(
      screen.queryByRole("spinbutton", { name: "Estimated pool depth (m)" }),
    ).not.toBeInTheDocument();

    await openValidPlacement(user, "homeowner");
    expect(
      screen.queryByRole("spinbutton", { name: "Estimated pool depth (m)" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Site questions")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Use this pool position" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Check this property" }),
    );
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([url]) => url.endsWith("/stages")),
      ).toHaveLength(2),
    );
    expect(await screen.findByTestId("details-form")).toHaveTextContent(
      "stage-token as homeowner",
    );

    await user.click(
      screen.getByRole("button", { name: /Who is this for?.*Completed/ }),
    );
    expect(screen.getByRole("radio", { name: "My property" })).toBeChecked();
    const revisitedBuilder = screen.getByRole("radio", {
      name: "A customer property",
    });
    await user.click(revisitedBuilder);
    expect(revisitedBuilder).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(
      screen.getByRole("spinbutton", { name: "Estimated pool depth (m)" }),
    ).toBeVisible();
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

  it("locks the chosen depth for checks and requires a new check after editing", async () => {
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
      screen.getByRole("button", { name: "Use this pool position" }),
    );
    const depth = await screen.findByRole("spinbutton", {
      name: "Estimated pool depth (m)",
    });
    await user.clear(depth);
    await user.type(depth, "1.9");
    await chooseNone(user);
    await waitFor(() => expect(depth).toBeDisabled());
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          url.endsWith("/stages") &&
          JSON.parse(String(init?.body)).estimatedDepthMetres === 1.9,
      ),
    ).toBe(true);
    await user.click(
      screen.getByRole("button", { name: "Edit estimated depth" }),
    );
    expect(depth).toBeEnabled();
    await user.clear(depth);
    await user.type(depth, "2");
    await user.click(
      screen.getByRole("button", { name: "Check this property" }),
    );
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            url.endsWith("/stages") &&
            JSON.parse(String(init?.body)).estimatedDepthMetres === 2,
        ),
      ).toBe(true),
    );
  });

  it("keeps signed answers on display-only changes and requires new answers after moving the pool", async () => {
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
      if (url.endsWith("/stages"))
        return Response.json({
          data: { status: "complete", layers: [], limitations: [] },
          assessmentSnapshot: "stage-token",
        });
      if (url.endsWith("/site-answers")) {
        const request = JSON.parse(String(init?.body));
        return Response.json({
          assessmentSnapshot: `signed-${request.assessmentSnapshot}`,
          answers: {
            version: 1,
            estimatedDepthMetres: 1.5,
            route: { provenance: "uncertain", geometry: null },
            accessConditions: request.accessConditions,
            nearbyFeatures: request.nearbyFeatures,
          },
        });
      }
      return Response.json({ suggestions: [] });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<PropertyCheckJourney />);
    await openValidPlacement(user, "pool_builder");
    await user.click(
      screen.getByRole("button", { name: "Use this pool position" }),
    );
    await chooseNone(user);
    expect(await screen.findByTestId("details-form")).toHaveTextContent(
      "signed-stage-token",
    );

    await user.click(
      screen.getByRole("button", { name: /Check the details.*Completed/ }),
    );
    await user.click(
      within(
        screen.getByRole("group", {
          name: "Which visible site conditions could affect plant access or excavation?",
        }),
      ).getByRole("checkbox", { name: "Restricted gate or narrow access" }),
    );
    expect(screen.queryByTestId("details-form")).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Save builder answers" }),
    );
    expect(await screen.findByTestId("details-form")).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: /Check the details.*Completed/ }),
    );
    await user.click(
      within(
        screen.getByRole("group", {
          name: "Which existing features are close to the proposed pool area?",
        }),
      ).getByRole("checkbox", { name: "Fences" }),
    );
    expect(screen.queryByTestId("details-form")).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Save builder answers" }),
    );
    expect(await screen.findByTestId("details-form")).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: /Check the details.*Completed/ }),
    );
    fireEvent.change(
      screen.getByRole("slider", {
        name: "Indicative excavation side clearance",
      }),
      { target: { value: "350" } },
    );
    expect(screen.queryByTestId("details-form")).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Save builder answers" }),
    );
    expect(await screen.findByTestId("details-form")).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: /Who is this for?.*Completed/ }),
    );
    await user.click(screen.getByRole("radio", { name: "My property" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(
      screen.getByRole("button", { name: "Continue to your details" }),
    );
    expect(screen.getByTestId("details-form")).toHaveTextContent(
      "stage-token as homeowner",
    );
    await user.click(
      screen.getByRole("button", { name: /Who is this for?.*Completed/ }),
    );
    await user.click(
      screen.getByRole("radio", { name: "A customer property" }),
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.queryByTestId("details-form")).not.toBeInTheDocument();
    await chooseNone(user);

    expect(screen.getByTestId("details-form")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: /Place your pool.*Completed/ }),
    );
    await user.click(screen.getByRole("button", { name: "Move pool" }));
    expect(screen.queryByTestId("details-form")).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Use this pool position" }),
    );
    await chooseNone(user);
    expect(await screen.findByTestId("details-form")).toBeVisible();
  });

  it("does not restore stale signed answers when the draft changes during saving", async () => {
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
      screen.getByRole("button", { name: "Use this pool position" }),
    );
    const access = screen.getByRole("group", {
      name: "Which visible site conditions could affect plant access or excavation?",
    });
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
      screen.getByRole("button", { name: "Check this property" }),
    );
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) => url.endsWith("/site-answers")),
      ).toBe(true),
    );

    await user.click(
      within(access).getByRole("checkbox", {
        name: "Restricted gate or narrow access",
      }),
    );
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

    expect(screen.queryByTestId("details-form")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save builder answers" }),
    ).toBeVisible();
  });

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
      screen.getByRole("button", { name: "Use this pool position" }),
    );
    await chooseNone(user);

    expect(
      await screen.findByText(/couldn’t complete the property check/i),
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: /Check the details.*Current/ }),
    );
    await user.click(
      screen.getByRole("button", { name: "Save builder answers" }),
    );
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
  const access = screen.getByRole("group", {
    name: "Which visible site conditions could affect plant access or excavation?",
  });
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
      name: /Check this property|Save builder answers/,
    }),
  );
}

function createJourneyFetch() {
  return vi.fn(async (url: string) => {
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

async function openValidPlacement(
  user: ReturnType<typeof userEvent.setup>,
  audience: "homeowner" | "pool_builder" = "homeowner",
) {
  const audienceRadio = screen.getByRole("radio", {
    name: audience === "homeowner" ? "My property" : "A customer property",
  });
  if (!(audienceRadio as HTMLInputElement).checked)
    await user.click(audienceRadio);
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.type(
    screen.getByLabelText("Auckland property address"),
    "1 Test Street, Auckland",
  );
  await user.keyboard("{Enter}");
  await user.click(
    await screen.findByRole("button", { name: "Set pool layout" }),
  );
}
