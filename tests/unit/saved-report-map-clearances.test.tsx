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
  expect(screen.getAllByText(/m$/)).toHaveLength(4);
  expect(
    screen
      .getByAltText(
        "Saved aerial assessment map showing the mapped property and proposed pool",
      )
      .closest("figure")
      ?.parentElement,
  ).toHaveClass("items-start");
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
  ).not.toBeInTheDocument();

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
  ).not.toBeInTheDocument();
});
