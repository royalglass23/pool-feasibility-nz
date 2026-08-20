"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

type ContactDialogState = "idle" | "sending" | "sent";

export function FooterContactDialog() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ContactDialogState>("idle");
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
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

  function close() {
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "sending") return;

    const form = event.currentTarget;
    const fields = new FormData(form);
    idempotencyKeyRef.current ??= crypto.randomUUID();
    setState("sending");
    setError(null);

    try {
      const response = await fetch("/api/public/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fields.get("name"),
          email: fields.get("email"),
          message: fields.get("message"),
          website: fields.get("website"),
          idempotencyKey: idempotencyKeyRef.current,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        sent?: boolean;
        error?: { message?: string };
      } | null;
      if (!response.ok || !body?.sent) {
        throw new Error(
          body?.error?.message ?? "We could not send your message.",
        );
      }
      form.reset();
      idempotencyKeyRef.current = null;
      setState("sent");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "We could not send your message.",
      );
      setState("idle");
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setState("idle");
          setError(null);
          setOpen(true);
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
            <form onSubmit={submit} className="mt-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" name="name" autoComplete="name" />
                <Field
                  label="Email"
                  name="email"
                  type="email"
                  autoComplete="email"
                />
                <label className="text-sm font-semibold sm:col-span-2">
                  How can we help?
                  <textarea
                    name="message"
                    required
                    minLength={10}
                    maxLength={2_000}
                    rows={4}
                    className="mt-1.5 block w-full resize-y rounded-lg border border-[#9fc8df] bg-white px-3 py-2.5 text-base font-normal transition outline-none focus:border-[#0077bd] focus:ring-2 focus:ring-[#a5d9f2]"
                  />
                </label>
              </div>
              <label className="sr-only" aria-hidden="true">
                Website
                <input name="website" tabIndex={-1} autoComplete="off" />
              </label>
              <p className="mt-3 text-xs leading-5 text-[#5c7e96]">
                We use these details only to respond to your enquiry. This is
                not marketing consent. Read our{" "}
                <Link
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[#006da9] underline decoration-[#85b8d4] underline-offset-4 hover:text-[#062f5d] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0077bd]"
                >
                  privacy notice
                </Link>
                .
              </p>
              {error && (
                <p
                  role="alert"
                  className="mt-3 text-sm font-semibold text-red-700"
                >
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={state === "sending"}
                className="mt-5 min-h-11 rounded-lg bg-[#062f5d] px-5 font-semibold text-white transition-colors hover:bg-[#074277] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0077bd] disabled:cursor-not-allowed disabled:bg-[#5c7e96]"
              >
                {state === "sending" ? "Sending message…" : "Send message"}
              </button>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}

function Field({
  label,
  name,
  type = "text",
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete: string;
}) {
  return (
    <label className="text-sm font-semibold">
      {label}
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        required
        maxLength={type === "email" ? 320 : 120}
        className="mt-1.5 block min-h-11 w-full rounded-lg border border-[#9fc8df] bg-white px-3 text-base font-normal transition outline-none focus:border-[#0077bd] focus:ring-2 focus:ring-[#a5d9f2]"
      />
    </label>
  );
}
