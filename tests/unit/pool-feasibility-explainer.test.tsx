import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { PoolFeasibilityExplainer } from "@/components/pool-feasibility-explainer";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("advances to the next property-check step after 3.6 seconds", async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false })),
  );
  render(<PoolFeasibilityExplainer />);

  await act(() => vi.advanceTimersByTimeAsync(3_600));

  expect(screen.getByText("Select a pool size").closest("li")).toHaveAttribute(
    "aria-current",
    "step",
  );
  expect(
    screen.getByRole("img", { name: "PoolReady example: select a pool size" }),
  ).toHaveAttribute(
    "src",
    expect.stringContaining("how-it-works-select-pool-v2"),
  );
});

it("changes the example when a property-check step is selected", async () => {
  const user = userEvent.setup();
  render(<PoolFeasibilityExplainer />);

  const selectPoolSize = screen.getByRole("button", {
    name: "Select a pool size",
  });
  await user.click(selectPoolSize);

  expect(selectPoolSize.closest("li")).toHaveAttribute("aria-current", "step");
  expect(
    screen.getByRole("img", { name: "PoolReady example: select a pool size" }),
  ).toBeVisible();
});

it("presents the property check as five concise steps with a privacy-safe example", () => {
  render(<PoolFeasibilityExplainer />);

  expect(
    screen.getByRole("list", { name: "Property check steps" }),
  ).toBeVisible();
  expect(screen.getByText("Find your property").closest("li")).toHaveAttribute(
    "aria-current",
    "step",
  );
  expect(screen.getByText("Select a pool size")).toBeVisible();
  expect(screen.getByText("Position your pool")).toBeVisible();
  expect(screen.getByText("Check mapped information")).toBeVisible();
  expect(screen.getByText("Understand your next steps")).toBeVisible();
  expect(
    screen.getByRole("img", { name: "PoolReady example: find your property" }),
  ).toHaveAttribute(
    "src",
    expect.stringContaining("how-it-works-find-property-v2"),
  );
  expect(screen.queryByText("Needs Checking")).not.toBeInTheDocument();
});
