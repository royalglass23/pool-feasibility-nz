import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PropertyCheckJourneyNav } from "@/components/property-check-journey-nav";

afterEach(cleanup);

describe("Property Check journey navigation", () => {
  it("shows one six-stage journey with accessible current, completed, and locked states", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(
      <PropertyCheckJourneyNav
        currentStage="placement"
        completedStages={["audience", "property"]}
        onNavigate={onNavigate}
      />,
    );

    const navigation = screen.getByRole("navigation", {
      name: "Property Check journey",
    });
    const buttons = screen.getAllByRole("button");

    expect(navigation).toBeVisible();
    expect(buttons.map((button) => button.textContent)).toEqual([
      "Who is this for?Completed",
      "Find the propertyCompleted",
      "Place your poolCurrent",
      "Check the detailsLocked",
      "Your detailsLocked",
      "Your property reportLocked",
    ]);
    expect(
      screen.getByRole("button", { name: /Place your pool.*Current/ }),
    ).toHaveAttribute("aria-current", "step");
    expect(
      screen.getByRole("button", { name: /Check the details.*Locked/ }),
    ).toBeDisabled();

    const property = screen.getByRole("button", {
      name: /Find the property.*Completed/,
    });
    property.focus();
    await user.keyboard("{Enter}");
    expect(onNavigate).toHaveBeenCalledWith("property");
  });
});
