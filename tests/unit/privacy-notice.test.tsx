import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HomeownerSubmissionForm } from "@/components/homeowner-submission-form";
import PrivacyNoticePage from "@/app/privacy/page";

vi.mock("server-only", () => ({}));

const placement = {
  position: [174.76, -36.85] as [number, number],
  rotationDegrees: 12,
  dimensions: { lengthMetres: 6.5, widthMetres: 3 },
  poolGeometry: null,
  constructionEnvelopeGeometry: null,
  constructionEnvelopeWithinMappedArea: true,
  warning: {
    status: "needs_checking" as const,
    label: "Needs Checking" as const,
    text: "Some mapped evidence is unavailable or uncertain.",
    recommendation: null,
    conflictingDatasets: [],
    checkingDatasets: [],
  },
};

describe("report-request privacy notice", () => {
  it("links to the notice immediately before report-delivery consent", () => {
    render(
      <HomeownerSubmissionForm
        assessmentSnapshot="server-issued-assessment-snapshot"
        placement={placement}
        onSaved={vi.fn()}
      />,
    );

    const link = screen.getByRole("link", { name: "privacy notice" });
    const consent = screen.getByRole("checkbox");

    expect(link).toHaveAttribute("href", "/privacy");
    expect(link.closest("p")?.nextElementSibling).toContainElement(consent);
    expect(screen.getByText(/not marketing consent/i)).toBeVisible();
  });

  it("plainly explains collection, purpose, retention, processors, and privacy requests", () => {
    const { container } = render(<PrivacyNoticePage />);
    const notice = within(container);

    expect(
      notice.getByRole("heading", { name: "Privacy notice" }),
    ).toBeVisible();
    expect(
      notice.getByText(/name, phone number, and email address/i),
    ).toBeVisible();
    expect(
      notice.getByText(/prepare, display, and email your preliminary report/i),
    ).toBeVisible();
    expect(notice.getByText(/12 months/i)).toBeVisible();
    expect(notice.getByText("Neon", { selector: "strong" })).toBeVisible();
    expect(notice.getByText("Resend", { selector: "strong" })).toBeVisible();
    expect(notice.getByText("ServiceM8", { selector: "strong" })).toBeVisible();
    expect(
      notice.getAllByText(/contact details, checked address, visitor type/i),
    ).toHaveLength(2);
    expect(
      notice.getByText(
        /homeowner report email and the ServiceM8 notification/i,
      ),
    ).toBeVisible();
    expect(
      notice.getByText(
        /12-month retention requirement applies to linked provider copies/i,
      ),
    ).toBeVisible();
    expect(
      notice.getByRole("link", { name: "support@royalglass.co.nz" }),
    ).toHaveAttribute("href", "mailto:support@royalglass.co.nz");
    expect(
      notice.getByText(/does not sign you up for marketing/i),
    ).toBeVisible();
  });
});
