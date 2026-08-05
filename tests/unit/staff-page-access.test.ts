import { afterEach, describe, expect, it, vi } from "vitest";

const cookieGet = vi.hoisted(() => vi.fn());
const hasAuthenticatedStaffSessionToken = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() =>
  vi.fn((location: string): never => {
    throw new Error(`NEXT_REDIRECT:${location}`);
  }),
);

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGet }),
}));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/modules/staff/staff-session", () => ({
  hasAuthenticatedStaffSessionToken,
}));
vi.mock("@/db/repositories/staff-auth-repository", () => ({
  staffSessionConfig: { cookieName: "rg_staff_session" },
}));
vi.mock("@/components/staff/staff-assessment-detail-client", () => ({
  StaffAssessmentDetailClient: () => null,
}));
vi.mock("@/app/staff/sign-in/actions", () => ({
  signOutStaffAdmin: vi.fn(),
}));

import StaffAssessmentPage from "@/app/staff/[id]/page";

afterEach(() => {
  cookieGet.mockReset();
  hasAuthenticatedStaffSessionToken.mockReset();
  redirect.mockClear();
});

describe("Admin page access", () => {
  it("redirects without carrying the requested saved-record identifier", async () => {
    cookieGet.mockReturnValue(undefined);
    hasAuthenticatedStaffSessionToken.mockResolvedValue(false);

    await expect(
      StaffAssessmentPage({
        params: Promise.resolve({ id: "private-assessment-id" }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/staff/sign-in");

    expect(redirect).toHaveBeenCalledWith("/staff/sign-in");
    expect(JSON.stringify(redirect.mock.calls)).not.toContain(
      "private-assessment-id",
    );
  });
});
