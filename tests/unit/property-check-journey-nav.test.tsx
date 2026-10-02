import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PropertyCheckJourneyNav } from "@/components/property-check-journey-nav";

afterEach(cleanup);

describe("Property Check journey navigation", () => {
  it("shows the current step first on mobile with an expandable journey overview", async () => {
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
    const stageList = within(navigation).getByRole("list");
    const stageButtons = within(stageList).getAllByRole("button");
    const journeyToggle = within(navigation).getByRole("button", {
      name: "View all steps",
    });

    expect(navigation).toBeVisible();
    expect(stageButtons.map((button) => button.textContent)).toEqual([
      "Who is this for?Completed",
      "Find the propertyCompleted",
      "Plan your poolStep 3 of 5 · Current",
      "Your detailsUpcoming",
      "Your property reportUpcoming",
    ]);
    expect(journeyToggle).toHaveAttribute("aria-expanded", "false");
    expect(stageButtons[0].closest("li")).toHaveClass("hidden", "sm:block");
    expect(stageButtons[2].closest("li")).not.toHaveClass("hidden");
    expect(
      screen.getByRole("button", {
        name: /Plan your pool.*Step 3 of 5.*Current/,
      }),
    ).toHaveAttribute("aria-current", "step");
    expect(
      screen.getByRole("button", { name: /Your details.*Upcoming/ }),
    ).toBeDisabled();

    await user.click(journeyToggle);
    expect(journeyToggle).toHaveAccessibleName("Hide steps");
    expect(journeyToggle).toHaveAttribute("aria-expanded", "true");
    expect(stageButtons[0].closest("li")).not.toHaveClass("hidden");

    const property = screen.getByRole("button", {
      name: /Find the property.*Completed/,
    });
    property.focus();
    await user.keyboard("{Enter}");
    expect(onNavigate).toHaveBeenCalledWith("property");
  });

  it("keeps the pathway available while locking the completed property stage", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(
      <PropertyCheckJourneyNav
        currentStage="placement"
        completedStages={["audience", "property"]}
        onNavigate={onNavigate}
        lockCompletedStages
      />,
    );

    const audience = screen.getByRole("button", {
      name: /Who is this for?.*Completed/,
    });
    const property = screen.getByRole("button", {
      name: /Find the property.*Completed/,
    });

    expect(audience).toBeEnabled();
    expect(property).toBeDisabled();
    await user.click(audience);
    expect(onNavigate).toHaveBeenCalledWith("audience");
    await user.click(property);
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("locks the completed audience stage after constraints load", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(
      <PropertyCheckJourneyNav
        currentStage="placement"
        completedStages={["audience", "property"]}
        onNavigate={onNavigate}
        lockCompletedStages
        lockAudienceStage
      />,
    );

    const audience = screen.getByRole("button", {
      name: /Who is this for?.*Completed/,
    });
    expect(audience).toBeDisabled();
    await user.click(audience);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it.each(["contact", "report"] as const)(
    "locks every earlier stage while the user is on %s",
    async (currentStage) => {
      const user = userEvent.setup();
      const onNavigate = vi.fn();

      render(
        <PropertyCheckJourneyNav
          currentStage={currentStage}
          completedStages={
            currentStage === "contact"
              ? ["audience", "property", "placement"]
              : ["audience", "property", "placement", "contact"]
          }
          onNavigate={onNavigate}
          lockCompletedStages
        />,
      );

      for (const name of [
        /Who is this for?.*Completed/,
        /Find the property.*Completed/,
        /Plan your pool.*Completed/,
      ]) {
        const stage = screen.getByRole("button", { name });
        expect(stage).toBeDisabled();
        await user.click(stage);
      }
      if (currentStage === "report") {
        const details = screen.getByRole("button", {
          name: /Your details.*Completed/,
        });
        expect(details).toBeDisabled();
        await user.click(details);
      }

      expect(onNavigate).not.toHaveBeenCalled();
    },
  );
});
