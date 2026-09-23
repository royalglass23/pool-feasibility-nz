import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
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
    onLoadDetailed,
    estimatedDepth,
    depthLocked,
    onEstimatedDepthChange,
    onEditEstimatedDepth,
    planningStep,
    planningEnabled,
  }: {
    onPlacementChange: (placement: FastPoolPlacementSnapshot) => void;
    onSnapshotReady: (snapshot: {
      imageDataUrl: string;
      visibleLayerKeys: string[];
    }) => void;
    onLoadDetailed: () => void;
    estimatedDepth?: string;
    depthLocked: boolean;
    onEstimatedDepthChange: (value: string) => void;
    onEditEstimatedDepth: () => void;
    planningStep?: React.ReactNode;
    planningEnabled?: boolean;
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
        {planningEnabled && estimatedDepth !== undefined && (
          <input
            aria-label="Estimated pool depth (m)"
            value={estimatedDepth}
            disabled={depthLocked}
            onChange={(event) => onEstimatedDepthChange(event.target.value)}
          />
        )}
        {planningEnabled && (
          <button onClick={onLoadDetailed}>Check for constraints</button>
        )}
        <button onClick={onEditEstimatedDepth}>Edit estimated depth</button>
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
  it("takes homeowners from mapped checks to details without technical inputs", async () => {
    const user = userEvent.setup();
    const fetchMock = createJourneyFetch();
    vi.stubGlobal("fetch", fetchMock);

    render(<PropertyCheckJourney />);
    await openValidPlacement(user);

    const homeowner = screen.getByRole("radio", { name: "My property" });
    const builder = screen.getByRole("radio", {
      name: "A customer property",
    });
    expect(homeowner).not.toBeChecked();
    expect(builder).not.toBeChecked();
    expect(
      screen.queryByRole("textbox", { name: "Estimated pool depth (m)" }),
    ).not.toBeInTheDocument();

    homeowner.focus();
    await user.keyboard(" ");
    expect(homeowner).toBeChecked();
    expect(
      screen.queryByRole("textbox", { name: "Estimated pool depth (m)" }),
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
    await user.click(screen.getByRole("button", { name: "Hide clearances" }));
    expect(await screen.findByTestId("details-form")).toHaveTextContent(
      "stage-token as homeowner",
    );

    await user.click(builder);
    expect(builder).toBeChecked();
    expect(
      screen.getByRole("textbox", { name: "Estimated pool depth (m)" }),
    ).toBeVisible();
  });

  it("visibly preselects the switchable builder pathway for builder entry", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", createJourneyFetch());

    render(<PropertyCheckJourney initialReportAudience="pool_builder" />);
    await openValidPlacement(user);

    const builder = screen.getByRole("radio", {
      name: "A customer property",
    });
    expect(builder).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "My property" }));
    expect(builder).not.toBeChecked();
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
            detailedChecks: { status: "complete", layers: [], limitations: [] },
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
    await user.type(
      screen.getByLabelText("Auckland property address"),
      "1 Test Street, Auckland",
    );
    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) => url.endsWith("/stages")),
      ).toBe(true),
    );
    await user.click(
      await screen.findByRole("button", { name: "Set pool layout" }),
    );
    await user.click(
      screen.getByRole("radio", { name: "A customer property" }),
    );
    const depth = await screen.findByRole("textbox", {
      name: "Estimated pool depth (m)",
    });
    await user.clear(depth);
    await user.type(depth, "1.9");
    await user.click(
      screen.getByRole("button", { name: "Check for constraints" }),
    );
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
      screen.getByRole("button", { name: "Check for constraints" }),
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
            detailedChecks: { status: "complete", layers: [], limitations: [] },
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
    await user.type(
      screen.getByLabelText("Auckland property address"),
      "1 Test Street, Auckland",
    );
    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) => url.endsWith("/stages")),
      ).toBe(true),
    );
    await user.click(
      await screen.findByRole("button", { name: "Set pool layout" }),
    );
    await user.click(
      screen.getByRole("radio", { name: "A customer property" }),
    );
    await chooseNone(user);
    expect(await screen.findByTestId("details-form")).toHaveTextContent(
      "signed-stage-token",
    );

    await user.click(screen.getByRole("radio", { name: "My property" }));
    expect(screen.getByTestId("details-form")).toHaveTextContent(
      "stage-token as homeowner",
    );
    await user.click(
      screen.getByRole("radio", { name: "A customer property" }),
    );
    expect(screen.queryByTestId("details-form")).not.toBeInTheDocument();
    await chooseNone(user);

    await user.click(screen.getByRole("button", { name: "Hide clearances" }));
    expect(screen.getByTestId("details-form")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Move pool" }));
    expect(screen.queryByTestId("details-form")).not.toBeInTheDocument();
    await chooseNone(user);
    expect(await screen.findByTestId("details-form")).toBeVisible();
  });
});

async function chooseNone(user: ReturnType<typeof userEvent.setup>) {
  const access = screen.getByRole("group", {
    name: "Are there any visible conditions that could affect construction access or excavation?",
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
    screen.getByRole("button", { name: "Continue to your details" }),
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

async function openValidPlacement(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    screen.getByLabelText("Auckland property address"),
    "1 Test Street, Auckland",
  );
  await user.keyboard("{Enter}");
  await user.click(
    await screen.findByRole("button", { name: "Set pool layout" }),
  );
}
