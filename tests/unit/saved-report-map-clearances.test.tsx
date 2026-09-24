import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SavedReportInteractiveMap } from "@/components/saved-report-interactive-map";
import { buildTestPreliminaryReport } from "../fixtures/preliminary-report";

it("reproduces the selected pool-shell clearance state in the saved report", () => {
  const { rerender } = render(
    <SavedReportInteractiveMap
      report={buildTestPreliminaryReport({
        pool: { clearancesVisible: true },
      })}
      attribution="Test map attribution"
    />,
  );

  expect(
    screen.getByRole("region", { name: "Saved pool-shell clearances" }),
  ).toHaveTextContent("Indicative mapped pool-shell clearances");
  expect(screen.getByRole("heading", { name: "Map layers" })).toBeVisible();
  expect(
    screen.getByRole("region", { name: "Saved assessment overlays" }),
  ).toBeVisible();
  expect(screen.getByRole("region", { name: "Saved contours" })).toBeVisible();
  expect(screen.getAllByText(/m$/)).toHaveLength(4);
  expect(
    screen
      .getByAltText(
        "Saved aerial assessment map showing the mapped property and proposed pool",
      )
      .closest("figure")?.parentElement,
  ).toHaveClass("items-start");
  expect(
    screen.getByAltText(
      "Saved aerial assessment map showing the mapped property and proposed pool",
    ),
  ).toHaveClass("h-auto", "w-full", "object-contain");
  expect(
    screen.getByRole("list", { name: "Saved mapped services" }),
  ).toHaveClass("lg:grid-cols-5");
  expect(
    screen
      .getByRole("region", { name: "Saved pool-shell clearances" })
      .compareDocumentPosition(
        screen.getByText("Mapped property boundary").closest("ul")!,
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();

  rerender(
    <SavedReportInteractiveMap
      report={buildTestPreliminaryReport({
        pool: { clearancesVisible: false },
      })}
      attribution="Test map attribution"
    />,
  );

  expect(
    screen.queryByRole("region", { name: "Saved pool-shell clearances" }),
  ).toHaveTextContent("Not shown in saved capture");

  rerender(
    <SavedReportInteractiveMap
      report={buildTestPreliminaryReport({
        pool: {
          clearancesVisible: true,
          shellGeometry: {
            type: "Polygon",
            coordinates: [["malformed"]],
          } as never,
        },
      })}
      attribution="Test map attribution"
    />,
  );

  expect(
    screen.queryByRole("region", { name: "Saved pool-shell clearances" }),
  ).toHaveTextContent("Measurements unavailable");
});
