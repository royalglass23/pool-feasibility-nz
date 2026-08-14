import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActionProgressDialog } from "@/components/action-progress-dialog";

it("centres an open progress dialog on a phone-sized viewport", () => {
  render(
    <ActionProgressDialog
      open
      title="Saving your assessment"
      description="Saving your details and preparing your preliminary report."
    />,
  );

  expect(
    screen.getByRole("dialog", { name: "Saving your assessment" }),
  ).toHaveClass("-translate-x-1/2", "-translate-y-1/2");
});
