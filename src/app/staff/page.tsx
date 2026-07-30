import { notFound } from "next/navigation";
import { StaffAssessmentDashboardClient } from "@/components/staff/staff-assessment-dashboard-client";
import { isDevelopmentStaffAccessAllowed } from "@/modules/staff/development-staff-access";

export const dynamic = "force-dynamic";

export default function StaffPage() {
  if (!isDevelopmentStaffAccessAllowed()) notFound();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,_#ccfbf1_0,_transparent_34%),linear-gradient(180deg,_#f8fafc_0%,_#eef2f6_100%)] px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-8 max-w-3xl">
          <p className="text-xs font-bold tracking-[0.18em] text-teal-700 uppercase">
            Royal Glass staff · saved assessment register
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-5xl">
            Staff assessment dashboard
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            Review each homeowner’s submitted pool layout and its saved evidence
            state. New submissions appear first.
          </p>
          <p className="mt-5 inline-flex rounded-full border border-amber-700/20 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900">
            Development-only · no staff authentication
          </p>
        </header>

        <StaffAssessmentDashboardClient />
      </div>
    </main>
  );
}
