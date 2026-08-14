"use client";

import { useEffect, useId, useRef } from "react";
import { LoaderCircle } from "lucide-react";

export function ActionProgressDialog({
  open,
  title,
  description,
}: {
  open: boolean;
  title: string;
  description: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) {
        if (typeof dialog.showModal === "function") {
          try {
            dialog.showModal();
          } catch {
            dialog.setAttribute("open", "");
          }
        }
        if (!dialog.open) {
          dialog.setAttribute("open", "");
        }
      }
      dialog.focus();
      return;
    }

    if (dialog.open) {
      try {
        dialog.close();
      } catch {
        dialog.removeAttribute("open");
      }
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-modal="true"
      onCancel={(event) => event.preventDefault()}
      tabIndex={-1}
      className="border-pool-200 text-pool-950 backdrop:bg-pool-950/45 fixed top-1/2 left-1/2 w-[min(calc(100%-2rem),28rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-white p-0 shadow-xl"
    >
      <div className="flex items-start gap-4 p-6">
        <span className="bg-pool-blue-50 text-pool-blue-800 grid size-11 shrink-0 place-items-center rounded-full">
          <LoaderCircle
            className="size-5 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        </span>
        <div className="min-w-0">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <p
            id={descriptionId}
            className="text-pool-600 mt-1 text-sm leading-6"
          >
            {description}
          </p>
          <p className="text-pool-700 mt-3 text-sm font-medium" role="status">
            Please wait…
          </p>
        </div>
      </div>
    </dialog>
  );
}
