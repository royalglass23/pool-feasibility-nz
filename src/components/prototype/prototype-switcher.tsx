"use client";

import { useCallback, useEffect } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type PrototypeVariant = {
  key: "A" | "B" | "C";
  name: string;
};

export function PrototypeSwitcher({
  variants,
  current,
}: {
  variants: readonly PrototypeVariant[];
  current: PrototypeVariant["key"];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentIndex = variants.findIndex((variant) => variant.key === current);

  const move = useCallback(
    (direction: -1 | 1) => {
      const nextIndex =
        (currentIndex + direction + variants.length) % variants.length;
      const params = new URLSearchParams(searchParams.toString());
      params.set("variant", variants[nextIndex].key);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [currentIndex, pathname, router, searchParams, variants],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.matches("input, textarea, [contenteditable='true']") ||
        (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
      ) {
        return;
      }
      event.preventDefault();
      move(event.key === "ArrowLeft" ? -1 : 1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [move]);

  if (process.env.NODE_ENV === "production") return null;

  const selected = variants[currentIndex] ?? variants[0];
  return (
    <nav
      aria-label="Prototype variants"
      className="fixed bottom-5 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/20 bg-[#102523]/95 p-1.5 text-white shadow-[0_18px_55px_rgba(3,18,16,0.38)] backdrop-blur-md"
    >
      <button
        type="button"
        onClick={() => move(-1)}
        aria-label="Previous variant"
        className="grid size-10 place-items-center rounded-full transition hover:bg-white/12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
      </button>
      <p
        className="min-w-52 px-3 text-center text-xs font-bold tracking-[0.08em] uppercase"
        aria-live="polite"
      >
        {selected.key} — {selected.name}
      </p>
      <button
        type="button"
        onClick={() => move(1)}
        aria-label="Next variant"
        className="grid size-10 place-items-center rounded-full transition hover:bg-white/12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <ArrowRight aria-hidden="true" className="size-4" />
      </button>
    </nav>
  );
}
