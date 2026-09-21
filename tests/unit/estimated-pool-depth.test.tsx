import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { EstimatedPoolDepth } from "@/components/estimated-pool-depth";

afterEach(cleanup);

it("starts at 1.5 m, permits keyboard edits through 2.0 m, and explains specialist depth", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  function Editable() {
    const [value, setValue] = useState("1.5");
    return (
      <EstimatedPoolDepth
        value={value}
        locked={false}
        onChange={(next) => {
          onChange(next);
          setValue(next);
        }}
      />
    );
  }
  const { rerender } = render(<Editable />);
  const input = screen.getByRole("spinbutton", {
    name: "Estimated pool depth (m)",
  });
  expect(input).toHaveValue(1.5);
  expect(input).toHaveAttribute("max", "2");
  expect(screen.getByText(/PoolReady modelling scope limit/)).toBeVisible();
  await user.click(input);
  await user.keyboard("{Control>}a{/Control}1.8");
  expect(onChange).toHaveBeenLastCalledWith("1.8");
  rerender(
    <EstimatedPoolDepth value="1.8" locked={false} onChange={onChange} />,
  );
  expect(screen.queryByText(/Specialist depth/)).not.toBeInTheDocument();
  rerender(
    <EstimatedPoolDepth value="1.9" locked={false} onChange={onChange} />,
  );
  expect(
    screen.getByText("Specialist depth — professional confirmation required"),
  ).toBeVisible();
  rerender(<EstimatedPoolDepth value="2" locked={true} onChange={onChange} />);
  expect(
    screen.getByRole("spinbutton", { name: "Estimated pool depth (m)" }),
  ).toBeDisabled();
});

it.each(["", "0", "2.1", "Infinity", "NaN", "1e309"])(
  "identifies %s as invalid",
  (value) => {
    render(
      <EstimatedPoolDepth value={value} locked={false} onChange={() => {}} />,
    );
    expect(
      screen.getByRole("spinbutton", { name: "Estimated pool depth (m)" }),
    ).toHaveAttribute("aria-invalid", "true");
  },
);
