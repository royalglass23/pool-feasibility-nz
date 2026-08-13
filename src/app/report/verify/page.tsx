"use client";

import { useEffect, useState } from "react";

type VerificationState = "confirming" | "sent" | "failed";

export default function ReportRecipientVerificationPage() {
  const [state, setState] = useState<VerificationState>("confirming");

  useEffect(() => {
    const verificationToken = window.location.hash.slice(1);
    window.history.replaceState(null, "", window.location.pathname);
    if (!verificationToken) {
      setState("failed");
      return;
    }
    void fetch("/api/public/assessments/report/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verificationToken }),
    })
      .then((response) => setState(response.ok ? "sent" : "failed"))
      .catch(() => setState("failed"));
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl items-center px-5 py-12">
      <section className="border-pool-200 w-full rounded-2xl border bg-white p-7 shadow-sm">
        <p className="text-pool-blue-700 text-xs font-bold tracking-[0.16em] uppercase">
          Pool feasibility report
        </p>
        {state === "confirming" && (
          <>
            <h1 className="text-pool-950 mt-3 text-2xl font-semibold">
              Confirming your email
            </h1>
            <p className="text-pool-700 mt-3">
              Please wait while we confirm your address and prepare your report.
            </p>
          </>
        )}
        {state === "sent" && (
          <>
            <h1 className="text-pool-950 mt-3 text-2xl font-semibold">
              Your email is confirmed
            </h1>
            <p className="text-pool-700 mt-3">
              Your preliminary pool feasibility report is being sent now.
            </p>
          </>
        )}
        {state === "failed" && (
          <>
            <h1 className="text-pool-950 mt-3 text-2xl font-semibold">
              We could not confirm this email
            </h1>
            <p role="alert" className="text-pool-700 mt-3">
              This confirmation link is invalid or expired. Request a new
              preliminary report to receive another link.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
