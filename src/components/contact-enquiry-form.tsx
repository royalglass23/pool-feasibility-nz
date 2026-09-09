"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { contactSchemas } from "@/modules/contact/contact-fields";
import {
  friendlyFieldError,
  friendlyRequestError,
} from "@/components/form-feedback";

export function ContactEnquiryForm({
  purpose = "general",
  onSent,
}: {
  purpose?: "general" | "partnership";
  onSent?: () => void;
}) {
  const partnership = purpose === "partnership";
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const submissionRef = useRef<{ payload: string; key: string } | null>(null);
  const sendingRef = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sendingRef.current) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const payload = JSON.stringify({
      purpose,
      name: fields.get("name"),
      email: fields.get("email"),
      message: fields.get("message"),
      website: fields.get("website"),
      ...(partnership ? { company: fields.get("company") } : {}),
    });
    // Retry the same message safely; editing it starts a distinct enquiry.
    if (submissionRef.current?.payload !== payload) {
      submissionRef.current = { payload, key: crypto.randomUUID() };
    }
    const validated = contactSchemas[purpose].safeParse({
      ...JSON.parse(payload),
      idempotencyKey: submissionRef.current.key,
    });
    if (!validated.success) {
      setError(friendlyFieldError(validated.error.issues));
      const field = form.elements.namedItem(
        String(validated.error.issues[0]?.path[0]),
      );
      if (field instanceof HTMLElement) field.focus();
      return;
    }
    sendingRef.current = true;
    setState("sending");
    setError(null);
    try {
      const response = await fetch("/api/public/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated.data),
      });
      const body = (await response.json().catch(() => null)) as {
        sent?: boolean;
        error?: { message?: string };
      } | null;
      if (!response.ok || !body?.sent) {
        setError(friendlyRequestError(response.status, "send your message"));
        setState("idle");
        return;
      }
      form.reset();
      submissionRef.current = null;
      setState("sent");
      onSent?.();
    } catch {
      setError(friendlyRequestError(503, "send your message"));
      setState("idle");
    } finally {
      sendingRef.current = false;
    }
  }

  if (state === "sent") {
    return (
      <p className="mt-6 font-semibold text-[#0f5a46]" role="status">
        {partnership
          ? "Thanks — your partnership enquiry has been sent."
          : "Thanks — your message has been sent."}
      </p>
    );
  }

  return (
    <form onSubmit={submit} data-hj-suppress>
      <fieldset disabled={state === "sending"} className="grid min-w-0 gap-4">
        <Field
          label={partnership ? "Your name" : "Name"}
          name="name"
          autoComplete="name"
        />
        {partnership && (
          <Field
            label="Company"
            name="company"
            autoComplete="organization"
            maxLength={160}
          />
        )}
        <Field
          label={partnership ? "Work email" : "Email"}
          name="email"
          autoComplete="email"
          type="email"
          maxLength={320}
        />
        <label className="text-sm font-semibold">
          {partnership
            ? "Tell us about your business (optional)"
            : "How can we help?"}
          <textarea
            name="message"
            required={!partnership}
            minLength={partnership ? undefined : 10}
            maxLength={2_000}
            rows={4}
            className="mt-1.5 block w-full resize-y rounded-lg border border-[#9fc8df] bg-white px-3 py-2.5 text-base font-normal outline-none focus:border-[#0077bd] focus:ring-2 focus:ring-[#a5d9f2]"
          />
        </label>
        <label className="sr-only" aria-hidden="true">
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </fieldset>
      <p className="mt-3 text-xs leading-5 text-[#5c7e96]">
        We use these details only to respond to your{" "}
        {partnership ? "partnership enquiry" : "enquiry"}. This is not marketing
        consent. Read our{" "}
        <Link
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-[#006da9] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          privacy notice
        </Link>
        .
      </p>
      {error && (
        <div
          role="alert"
          className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-950"
        >
          <p>{error}</p>
        </div>
      )}
      <button
        type="submit"
        disabled={state === "sending"}
        className="mt-5 min-h-12 rounded-xl bg-[#062f5d] px-5 font-semibold text-white transition-colors hover:bg-[#074277] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0077bd] disabled:cursor-not-allowed disabled:bg-[#5c7e96]"
      >
        {state === "sending"
          ? "Sending message…"
          : partnership
            ? "Register your interest"
            : "Send message"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  autoComplete,
  type = "text",
  maxLength = 120,
}: {
  label: string;
  name: string;
  autoComplete: string;
  type?: string;
  maxLength?: number;
}) {
  return (
    <label className="text-sm font-semibold">
      {label}
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        required
        maxLength={maxLength}
        className="mt-1.5 block min-h-11 w-full rounded-lg border border-[#9fc8df] bg-white px-3 text-base font-normal outline-none focus:border-[#0077bd] focus:ring-2 focus:ring-[#a5d9f2]"
      />
    </label>
  );
}
