import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { StaffAssessmentDetailClient } from "@/components/staff/staff-assessment-detail-client";
import { staffSessionConfig } from "@/db/repositories/staff-auth-repository";
import { hasAuthenticatedStaffSessionToken } from "@/modules/staff/staff-session";
import { signOutStaffAdmin } from "../sign-in/actions";

export const dynamic = "force-dynamic";

export default async function StaffAssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessionToken = (await cookies()).get(
    staffSessionConfig.cookieName,
  )?.value;
  if (!(await hasAuthenticatedStaffSessionToken(sessionToken))) {
    redirect("/staff/sign-in");
  }
  const { id } = await params;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,_#ccfbf1_0,_transparent_30%),linear-gradient(180deg,_#f8fafc_0%,_#eef2f6_100%)] px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-5 flex justify-end">
          <form action={signOutStaffAdmin}>
            <button
              className="min-h-10 rounded-full border border-pool-300 bg-white px-4 text-sm font-semibold text-pool-700 shadow-sm hover:border-pool-blue-700/40 hover:text-pool-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pool-blue-700"
              type="submit"
            >
              Sign out
            </button>
          </form>
        </div>
        <StaffAssessmentDetailClient id={id} />
      </div>
    </main>
  );
}
