import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { PoolFeasibilityExplainer } from "@/components/pool-feasibility-explainer";

afterEach(cleanup);

it("presents the property check as five concise steps with a privacy-safe example", () => {
  render(<PoolFeasibilityExplainer />);

  expect(
    screen.getByRole("list", { name: "Property check steps" }),
  ).toBeVisible();
  expect(screen.getByText("Find your property")).toBeVisible();
  expect(screen.getByText("Select a pool size")).toBeVisible();
  expect(screen.getByText("Position your pool").closest("li")).toHaveAttribute(
    "aria-current",
    "step",
  );
  expect(screen.getByText("Check mapped information")).toBeVisible();
  expect(screen.getByText("Understand your next steps")).toBeVisible();
  expect(
    screen.getByAltText(
      "Illustrative aerial property view showing an indicative pool position and investigation buffer.",
    ),
  ).toHaveAttribute("src", expect.stringContaining("aerial-demonstration"));
  expect(screen.getByText("1 m indicative investigation buffer")).toBeVisible();
  expect(screen.queryByText("Needs Checking")).not.toBeInTheDocument();
});
