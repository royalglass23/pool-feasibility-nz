import Link from "next/link";
import { PoolReadyLogo } from "@/components/pool-ready-logo";

export function PoolReadyBrand() {
  return (
    <div className="shrink-0">
      <Link
        href="/"
        aria-label="PoolReady home"
        className="inline-flex min-h-11 items-center rounded-lg outline-offset-4 focus-visible:outline-2 focus-visible:outline-[#0077bd]"
      >
        <PoolReadyLogo />
      </Link>
      <p className="flex items-center gap-1 text-xs text-[#426b87]">
        powered by{" "}
        <a
          href="https://www.bluehaven.nz/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-7 items-center font-semibold text-[#006da9] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          BlueHaven<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </p>
    </div>
  );
}
