import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { EstimatedPoolDepth } from "@/components/estimated-pool-depth";

afterEach(cleanup);

it("uses an exact, keyboard-operable 1.0-2.0 m slider and explains specialist depth", async () => {
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
  const input = screen.getByRole("slider", {
    name: "Estimated pool depth (m)",
  });
  expect(input).toHaveValue("1.5");
  expect(input).toHaveAttribute("min", "1");
  expect(input).toHaveAttribute("max", "2");
  expect(input).toHaveAttribute("step", "0.1");
  expect(input).toHaveAttribute("aria-valuetext", "1.5 m");
  expect(screen.getByText("Minimum 1.0 m")).toBeVisible();
  expect(screen.getByText("Maximum 2.0 m")).toBeVisible();
  expect(screen.getByText(/PoolReady modelling scope limit/)).toBeVisible();
  input.focus();
  fireEvent.change(input, { target: { value: "1.9" } });
  expect(onChange).toHaveBeenLastCalledWith("1.9");
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
    screen.getByRole("slider", { name: "Estimated pool depth (m)" }),
  ).toBeDisabled();
});

it.each(["", "0", "0.9", "2.1", "Infinity", "NaN", "1e309"])(
  "identifies %s as invalid",
  (value) => {
    render(
      <EstimatedPoolDepth value={value} locked={false} onChange={() => {}} />,
    );
    expect(
      screen.getByRole("slider", { name: "Estimated pool depth (m)" }),
    ).toHaveAttribute("aria-invalid", "true");
  },
);
