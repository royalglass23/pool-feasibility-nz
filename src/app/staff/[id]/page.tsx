import { notFound } from "next/navigation";
import { StaffAssessmentDetailClient } from "@/components/staff/staff-assessment-detail-client";
import { isDevelopmentStaffAccessAllowed } from "@/modules/staff/development-staff-access";

export const dynamic = "force-dynamic";

export default async function StaffAssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isDevelopmentStaffAccessAllowed()) notFound();
  const { id } = await params;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,_#ccfbf1_0,_transparent_30%),linear-gradient(180deg,_#f8fafc_0%,_#eef2f6_100%)] px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-6xl">
        <p className="mb-5 inline-flex rounded-full border border-amber-700/20 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900">
          Development-only · no staff authentication · read-only detail
        </p>
        <StaffAssessmentDetailClient id={id} />
      </div>
    </main>
  );
}
