import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function FieldValidationMessage({
  id,
  children,
  className,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      id={id}
      role="alert"
      data-slot="field-validation-message"
      className={cn(
        "border-pool-300 text-pool-950 relative mt-2 flex w-fit max-w-full items-center gap-2 rounded-md border bg-white px-2.5 py-2 text-sm leading-5 font-normal shadow-[0_4px_12px_rgba(15,23,42,0.18)]",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="border-pool-300 absolute -top-1.5 left-4 size-3 rotate-45 border-t border-l bg-white"
      />
      <span className="grid size-7 shrink-0 place-items-center rounded-sm bg-orange-600 text-white">
        <AlertTriangle
          className="size-4"
          strokeWidth={2.5}
          aria-hidden="true"
        />
      </span>
      <span>{children}</span>
    </span>
  );
}
