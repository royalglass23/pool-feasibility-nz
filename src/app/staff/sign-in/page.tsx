import Link from "next/link";
import { signInStaffAdmin } from "./actions";

export const dynamic = "force-dynamic";

export default async function StaffSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-4 py-10 sm:px-6">
      <section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
        <Link
          href="/"
          className="text-sm font-semibold text-teal-800 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700"
        >
          Pool Feasibility NZ
        </Link>
        <p className="mt-8 text-xs font-bold tracking-[0.18em] text-teal-700 uppercase">
          Royal Glass staff
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-slate-950">
          Sign in to the workspace
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Use the individually provisioned Admin account to review saved report
          requests.
        </p>
        {error ? (
          <p
            role="alert"
            className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900"
          >
            We could not sign you in. Check your credentials or try again
            later.
          </p>
        ) : null}
        <form action={signInStaffAdmin} className="mt-7 space-y-5">
          <label className="block text-sm font-semibold text-slate-800">
            Username
            <input
              autoComplete="username"
              className="mt-2 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base shadow-sm outline-offset-2 focus:border-teal-700 focus:outline-2 focus:outline-teal-700"
              name="username"
              required
            />
          </label>
          <label className="block text-sm font-semibold text-slate-800">
            Password
            <input
              autoComplete="current-password"
              className="mt-2 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base shadow-sm outline-offset-2 focus:border-teal-700 focus:outline-2 focus:outline-teal-700"
              minLength={14}
              name="password"
              required
              type="password"
            />
          </label>
          <button
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-teal-800 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            type="submit"
          >
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
