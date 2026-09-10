"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FooterContactDialog } from "@/components/footer-contact-dialog";
import { PoolReadyBrand } from "@/components/pool-ready-brand";

export function SiteFooter() {
  const pathname = usePathname();
  if (/^\/(staff|prototype)(\/|$)/.test(pathname)) return null;

  return (
    <footer
      className="bg-[#f5faff] px-4 text-sm leading-6 text-[#426b87] sm:px-6 print:hidden"
      aria-label="Site information"
    >
      <div className="mx-auto w-full max-w-7xl border-t border-[#c6dce9] py-8 sm:py-10">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between sm:gap-12">
          <div className="max-w-xl">
            <PoolReadyBrand />
            <p className="mt-5 font-semibold text-[#062f5d]">
              Need help with your property check?
            </p>
            <p className="mt-2 text-pretty">
              Get in touch about a preliminary report or the next best step for
              your property.
            </p>
            <FooterContactDialog />
          </div>
          <nav
            aria-label="Footer navigation"
            className="flex shrink-0 flex-col items-start gap-2"
          >
            <Link href="/partners" className="site-menu-link">
              Partnership Program
            </Link>
            <Link href="/privacy" className="site-menu-link">
              Privacy notice
            </Link>
          </nav>
        </div>
        <p className="mt-8 border-t border-[#dbe8f0] pt-5 text-xs leading-5 text-[#5c7e96]">
          © {new Date().getFullYear()} PoolReady. Preliminary property guidance
          only. This tool does not determine pool feasibility, construction
          safety, consent requirements, title interests, easements, or exact
          underground service positions.
        </p>
      </div>
    </footer>
  );
}
