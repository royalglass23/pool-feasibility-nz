"use client";

import { ContactEnquiryForm } from "@/components/contact-enquiry-form";
import { useEffect, useId, useRef, useState } from "react";

type ContactDialogState = "idle" | "sent";
const CONTACT_HASH = "#contact";

export function FooterContactDialog() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ContactDialogState>("idle");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      try {
        dialog.showModal();
      } catch {
        dialog.setAttribute("open", "");
      }
      return;
    }

    if (!open && dialog.open) {
      try {
        dialog.close();
      } catch {
        dialog.removeAttribute("open");
      }
    }
  }, [open]);

  useEffect(() => {
    function syncWithLocationHash() {
      if (window.location.hash !== CONTACT_HASH) {
        setOpen(false);
        return;
      }

      setState("idle");
      setOpen(true);
    }

    syncWithLocationHash();
    window.addEventListener("hashchange", syncWithLocationHash);
    return () => window.removeEventListener("hashchange", syncWithLocationHash);
  }, []);

  function openDialog() {
    setState("idle");
    setOpen(true);
  }

  function close() {
    if (window.location.hash === CONTACT_HASH) {
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
    }
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (window.location.hash !== CONTACT_HASH) {
            window.history.replaceState(
              window.history.state,
              "",
              `${window.location.pathname}${window.location.search}${CONTACT_HASH}`,
            );
          }
          openDialog();
        }}
        className="mt-5 min-h-11 rounded-lg bg-[#062f5d] px-5 font-semibold text-white transition-colors hover:bg-[#074277] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0077bd]"
      >
        Contact us
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={headingId}
        aria-describedby={descriptionId}
        onCancel={close}
        onClose={() => setOpen(false)}
        className="fixed top-1/2 left-1/2 m-0 w-[min(calc(100%-2rem),34rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[#c6dce9] bg-white p-0 text-[#062f5d] shadow-xl backdrop:bg-[#062f5d]/55"
      >
        <div className="relative p-6 sm:p-7">
          <button
            type="button"
            onClick={close}
            className="absolute top-4 right-4 rounded-md px-2 py-1 text-sm font-semibold text-[#426b87] hover:bg-[#e9f7ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0077bd]"
          >
            Close
          </button>
          <h2
            id={headingId}
            className="pr-16 text-2xl font-semibold tracking-[-0.03em]"
          >
            Contact us
          </h2>
          <p
            id={descriptionId}
            className="mt-2 text-sm leading-6 text-[#426b87]"
          >
            Send a message and we&apos;ll help point you in the right direction.
          </p>

          {state === "sent" ? (
            <div className="mt-6">
              <p className="font-semibold text-[#0f5a46]" role="status">
                Thanks — your message has been sent.
              </p>
              <button
                type="button"
                onClick={close}
                className="mt-5 min-h-11 rounded-lg bg-[#062f5d] px-5 font-semibold text-white transition-colors hover:bg-[#074277] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0077bd]"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="mt-6">
              <ContactEnquiryForm onSent={() => setState("sent")} />
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
