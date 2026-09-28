import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReportAudiencePathway } from "@/components/report-audience-pathway";

afterEach(cleanup);

describe("report audience pathway", () => {
  it("starts unselected for generic entry and supports keyboard selection and switching", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    const { rerender } = render(
      <ReportAudiencePathway value={null} onChange={onChange} />,
    );

    const group = screen.getByRole("radiogroup", {
      name: "Who are you checking this property for?",
    });
    const homeowner = screen.getByRole("radio", { name: "My property" });
    const builder = screen.getByRole("radio", {
      name: "A customer property",
    });
    expect(group).toBeVisible();
    expect(homeowner).not.toBeChecked();
    expect(builder).not.toBeChecked();

    homeowner.focus();
    await user.keyboard(" ");
    expect(onChange).toHaveBeenLastCalledWith("homeowner");

    rerender(<ReportAudiencePathway value="homeowner" onChange={onChange} />);
    expect(homeowner).toBeChecked();
    await user.click(builder);
    expect(onChange).toHaveBeenLastCalledWith("pool_builder");
  });

  it("shows a builder preselection while keeping both choices enabled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ReportAudiencePathway value="pool_builder" onChange={onChange} />);

    const homeowner = screen.getByRole("radio", { name: "My property" });
    const builder = screen.getByRole("radio", {
      name: "A customer property",
    });
    expect(builder).toBeChecked();
    expect(homeowner).toBeEnabled();
    await user.click(homeowner);
    expect(onChange).toHaveBeenCalledWith("homeowner");
  });
});
