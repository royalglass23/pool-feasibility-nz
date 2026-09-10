import Link from "next/link";
import { PoolReadyLogo } from "@/components/pool-ready-logo";
import { signInStaffAdmin } from "./actions";

export const dynamic = "force-dynamic";

export default async function StaffSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="bg-pool-950 grid min-h-screen place-items-center px-4 py-10 sm:px-6">
      <section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
        <Link
          href="/"
          aria-label="PoolReady home"
          className="focus-visible:outline-pool-blue-700 inline-flex rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          <PoolReadyLogo />
        </Link>
        <p className="text-pool-blue-700 mt-8 text-xs font-bold tracking-[0.18em] uppercase">
          Royal Glass staff
        </p>
        <h1 className="text-pool-950 mt-3 text-3xl font-semibold tracking-[-0.035em]">
          Sign in to the workspace
        </h1>
        <p className="text-pool-600 mt-3 text-sm leading-6">
          Use the individually provisioned Admin account to review saved report
          requests.
        </p>
        {error ? (
          <p
            role="alert"
            className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900"
          >
            We could not sign you in. Check your credentials or try again later.
          </p>
        ) : null}
        <form action={signInStaffAdmin} className="mt-7 space-y-5">
          <label className="text-pool-800 block text-sm font-semibold">
            Username
            <input
              autoComplete="username"
              className="border-pool-300 focus:border-pool-blue-700 focus:outline-pool-blue-700 mt-2 block min-h-11 w-full rounded-xl border bg-white px-3 text-base shadow-sm outline-offset-2 focus:outline-2"
              name="username"
              required
            />
          </label>
          <label className="text-pool-800 block text-sm font-semibold">
            Password
            <input
              autoComplete="current-password"
              className="border-pool-300 focus:border-pool-blue-700 focus:outline-pool-blue-700 mt-2 block min-h-11 w-full rounded-xl border bg-white px-3 text-base shadow-sm outline-offset-2 focus:outline-2"
              minLength={14}
              name="password"
              required
              type="password"
            />
          </label>
          <button
            className="bg-pool-blue-800 hover:bg-pool-blue-900 focus-visible:outline-pool-blue-700 inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 py-2 text-sm font-bold text-white shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2"
            type="submit"
          >
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
