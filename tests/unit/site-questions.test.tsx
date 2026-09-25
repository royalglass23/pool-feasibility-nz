import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  SiteQuestions,
  type BuilderSiteQuestionDraft,
} from "@/components/site-questions";

afterEach(cleanup);

const credibleRoute = {
  confidence: "credible" as const,
  reason: "direct_clear_corridor" as const,
  geometry: {
    type: "LineString" as const,
    coordinates: [
      [174.76, -36.85] as [number, number],
      [174.761, -36.851] as [number, number],
    ],
  },
};

function renderQuestions(
  overrides: Partial<React.ComponentProps<typeof SiteQuestions>> = {},
) {
  const onCheckProperty = vi.fn(async () => true);
  const onSaveRouteAdjustment = vi.fn(async () => true);
  const onRouteEdit = vi.fn();
  const onDraftChange = vi.fn();
  render(
    <SiteQuestions
      placementKey="placement-1"
      estimatedDepth="1.5"
      depthLocked={false}
      onEstimatedDepthChange={() => undefined}
      onEditEstimatedDepth={() => undefined}
      hasCompletedCheck={false}
      hasSavedAnswers={false}
      isChecking={false}
      onCheckProperty={onCheckProperty}
      onSaveRouteAdjustment={onSaveRouteAdjustment}
      onRouteEdit={onRouteEdit}
      onDraftChange={onDraftChange}
      {...overrides}
    />,
  );
  return {
    onCheckProperty,
    onSaveRouteAdjustment,
    onRouteEdit,
    onDraftChange,
  };
}

async function chooseNone(user: ReturnType<typeof userEvent.setup>) {
  const accessButton = screen.getByRole("button", {
    name: "Access and excavation conditions",
  });
  if (accessButton.getAttribute("aria-expanded") === "false")
    await user.click(accessButton);
  const access = screen.getByRole("group", {
    name: "Which visible site conditions could affect plant access or excavation?",
  });
  await user.click(
    within(access).getByRole("checkbox", { name: "None of these" }),
  );
  const nearbyButton = screen.getByRole("button", { name: "Nearby features" });
  if (nearbyButton.getAttribute("aria-expanded") === "false")
    await user.click(nearbyButton);
  const nearby = screen.getByRole("group", {
    name: "Which existing features are close to the proposed pool area?",
  });
  await user.click(
    within(nearby).getByRole("checkbox", { name: "None of these" }),
  );
}

describe("Pool builder site questions", () => {
  it("keeps compact selections visible and enforces exclusive answers in both directions", async () => {
    const user = userEvent.setup();
    renderQuestions();

    const accessButton = screen.getByRole("button", {
      name: "Access and excavation conditions",
    });
    expect(accessButton).toHaveAttribute("aria-expanded", "false");
    accessButton.focus();
    await user.keyboard(" ");
    expect(accessButton).toHaveAttribute("aria-expanded", "true");

    const access = screen.getByRole("group", {
      name: "Which visible site conditions could affect plant access or excavation?",
    });
    const none = within(access).getByRole("checkbox", {
      name: "None of these",
    });
    const restricted = within(access).getByRole("checkbox", {
      name: "Restricted gate or narrow access",
    });
    await user.click(none);
    expect(none).toBeChecked();
    await user.click(restricted);
    expect(none).not.toBeChecked();
    expect(restricted).toBeChecked();
    await user.click(none);
    expect(restricted).not.toBeChecked();

    await user.click(accessButton);
    expect(accessButton).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.getByRole("button", { name: "Remove None of these" }),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Nearby features" }));
    const nearby = screen.getByRole("group", {
      name: "Which existing features are close to the proposed pool area?",
    });
    await user.click(within(nearby).getByRole("checkbox", { name: "Fences" }));
    await user.click(within(nearby).getByRole("checkbox", { name: "Walls" }));
    await user.click(
      within(nearby).getByRole("checkbox", { name: "I’m not sure" }),
    );
    expect(
      within(nearby).getByRole("checkbox", { name: "Fences" }),
    ).not.toBeChecked();
    expect(
      within(nearby).getByRole("checkbox", { name: "Walls" }),
    ).not.toBeChecked();
    expect(
      within(nearby).getByRole("checkbox", { name: "I’m not sure" }),
    ).toBeChecked();
  });

  it("clears one selected answer without erasing unrelated answers", async () => {
    const user = userEvent.setup();
    renderQuestions();
    const nearbyButton = screen.getByRole("button", {
      name: "Nearby features",
    });
    await user.click(nearbyButton);
    const nearby = screen.getByRole("group", {
      name: "Which existing features are close to the proposed pool area?",
    });
    await user.click(within(nearby).getByRole("checkbox", { name: "Fences" }));
    await user.click(within(nearby).getByRole("checkbox", { name: "Walls" }));
    await user.click(nearbyButton);

    await user.click(screen.getByRole("button", { name: "Remove Fences" }));
    expect(
      screen.queryByRole("button", { name: "Remove Fences" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Walls" })).toBeVisible();
  });

  it("collects depth and site observations before one property check", async () => {
    const user = userEvent.setup();
    const { onCheckProperty } = renderQuestions();

    expect(
      screen.getByRole("slider", { name: "Estimated pool depth (m)" }),
    ).toHaveValue("1.5");
    expect(
      screen.queryByRole("heading", { name: "Access route result" }),
    ).not.toBeInTheDocument();

    await chooseNone(user);
    const clearance = screen.getByRole("slider", {
      name: "Indicative excavation side clearance",
    });
    fireEvent.change(clearance, { target: { value: "200" } });
    expect(screen.getByText(/below the provisional 300 mm/i)).toBeVisible();
    expect(screen.queryByText(/Needs checking/i)).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Check this property" }),
    );
    expect(onCheckProperty).toHaveBeenCalledWith({
      accessConditions: ["none_of_these"],
      nearbyFeatures: ["none_of_these"],
      sideClearanceMillimetres: 200,
    } satisfies BuilderSiteQuestionDraft);
  });

  it("requires both observed-condition answers and preserves them after failure", async () => {
    const user = userEvent.setup();
    const onCheckProperty = vi.fn(async () => false);
    renderQuestions({ onCheckProperty });

    await user.click(
      screen.getByRole("button", { name: "Check this property" }),
    );
    expect(
      screen.getByText("Record at least one access or excavation condition."),
    ).toBeVisible();
    expect(onCheckProperty).not.toHaveBeenCalled();

    await chooseNone(user);
    await user.click(
      screen.getByRole("button", { name: "Check this property" }),
    );
    expect(
      await screen.findByText(/couldn’t complete the property check/i),
    ).toBeVisible();
    screen
      .getAllByRole("checkbox", { name: "None of these" })
      .forEach((checkbox) => expect(checkbox).toBeChecked());
  });

  it("shows the suggested route as a result and saves an optional adjustment without another check", async () => {
    const user = userEvent.setup();
    const adjustedRoute = {
      type: "LineString" as const,
      coordinates: [
        [174.76, -36.85] as [number, number],
        [174.7605, -36.8505] as [number, number],
        [174.761, -36.851] as [number, number],
      ],
    };
    const { onSaveRouteAdjustment } = renderQuestions({
      hasCompletedCheck: true,
      hasSavedAnswers: true,
      depthLocked: true,
      routeSuggestion: credibleRoute,
      adjustedRoute,
    });

    expect(
      screen.getByRole("heading", { name: "Access route result" }),
    ).toBeVisible();
    expect(screen.getByText(/has not been confirmed/i)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Check this property" }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Save route adjustment" }),
    );
    expect(onSaveRouteAdjustment).toHaveBeenCalledWith(
      expect.objectContaining({ adjustedRoute }),
    );
  });

  it("returns to saving builder answers after the final route turning point is removed", async () => {
    const user = userEvent.setup();
    const adjustedRoute = {
      type: "LineString" as const,
      coordinates: [
        [174.76, -36.85] as [number, number],
        [174.7605, -36.8505] as [number, number],
        [174.761, -36.851] as [number, number],
      ],
    };
    const { onRouteEdit } = renderQuestions({
      hasCompletedCheck: true,
      hasSavedAnswers: true,
      depthLocked: true,
      routeSuggestion: credibleRoute,
      adjustedRoute,
    });

    await user.click(
      screen.getByRole("button", { name: "Remove last turning point" }),
    );
    const restoredSuggestedRoute = onRouteEdit.mock.lastCall?.[0];
    expect(restoredSuggestedRoute?.coordinates).toHaveLength(2);

    cleanup();
    const { onCheckProperty, onSaveRouteAdjustment } = renderQuestions({
      hasCompletedCheck: true,
      hasSavedAnswers: false,
      depthLocked: true,
      routeSuggestion: credibleRoute,
      adjustedRoute: restoredSuggestedRoute,
    });
    await chooseNone(user);
    await user.click(
      screen.getByRole("button", { name: "Save builder answers" }),
    );

    expect(onCheckProperty).toHaveBeenCalledOnce();
    expect(onSaveRouteAdjustment).not.toHaveBeenCalled();
  });

  it("reports an unconfirmed route when mapped evidence is insufficient", () => {
    renderQuestions({
      hasCompletedCheck: true,
      hasSavedAnswers: true,
      depthLocked: true,
      routeSuggestion: {
        confidence: "uncertain",
        geometry: null,
        reason: "terrain_unavailable_or_steep",
      },
    });

    expect(screen.getByText(/Access route not confirmed/i)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Adjust suggested route" }),
    ).not.toBeInTheDocument();
  });
});
