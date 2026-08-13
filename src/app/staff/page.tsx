import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { StaffAssessmentDashboardClient } from "@/components/staff/staff-assessment-dashboard-client";
import { staffSessionConfig } from "@/db/repositories/staff-auth-repository";
import { hasAuthenticatedStaffSessionToken } from "@/modules/staff/staff-session";
import { signOutStaffAdmin } from "./sign-in/actions";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const sessionToken = (await cookies()).get(
    staffSessionConfig.cookieName,
  )?.value;
  if (!(await hasAuthenticatedStaffSessionToken(sessionToken))) {
    redirect("/staff/sign-in");
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,_#ccfbf1_0,_transparent_34%),linear-gradient(180deg,_#f8fafc_0%,_#eef2f6_100%)] px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-8 max-w-3xl">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-bold tracking-[0.18em] text-pool-blue-700 uppercase">
              Royal Glass staff - saved assessment register
            </p>
            <form action={signOutStaffAdmin}>
              <button
                className="min-h-10 rounded-full border border-pool-300 bg-white px-4 text-sm font-semibold text-pool-700 shadow-sm hover:border-pool-blue-700/40 hover:text-pool-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pool-blue-700"
                type="submit"
              >
                Sign out
              </button>
            </form>
          </div>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em] text-pool-950 sm:text-5xl">
            Staff assessment dashboard
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-pool-600">
            Review each homeowner&apos;s submitted pool layout and its saved evidence
            state. New submissions appear first.
          </p>
        </header>

        <StaffAssessmentDashboardClient />
      </div>
    </main>
  );
}
