"use client";

import { useActionState, useEffect, useRef } from "react";
import { useNotification } from "components/notifications";
import { submitContactForm, type ContactFormState } from "./actions";

function FieldError({ error }: { error?: string }) {
  if (!error) {
    return null;
  }

  return <p className="mt-2 text-sm text-red-600">{error}</p>;
}

export function ContactForm() {
  const { showNotification } = useNotification();
  const [state, formAction, isPending] = useActionState<
    ContactFormState,
    FormData
  >(submitContactForm, null);
  const handledState = useRef<ContactFormState>(null);
  const fieldErrors = state?.fieldErrors ?? {};

  useEffect(() => {
    if (!state || handledState.current === state) {
      return;
    }

    handledState.current = state;

    if (state.success) {
      showNotification(
        "success",
        "Message sent",
        "We typically respond within one business day.",
      );
      return;
    }

    if (state.error && !state.fieldErrors) {
      showNotification("error", "Could not send message", state.error);
    }
  }, [showNotification, state]);

  if (state?.success) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl bg-green-50 px-8 py-10 text-center">
        <p className="text-base/7 font-semibold text-green-800">
          Message sent. Thanks for reaching out.
        </p>
        <p className="mt-2 text-sm/6 text-green-700">
          We typically respond within one business day.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mx-auto mt-16 max-w-xl sm:mt-20">
      {state?.error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div
        aria-hidden="true"
        className="absolute top-auto left-[-9999px] h-px w-px overflow-hidden"
      >
        <label htmlFor="company">Company</label>
        <input
          id="company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue={state?.values?.company ?? ""}
        />
      </div>

      <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
        <div>
          <label
            htmlFor="first_name"
            className="block text-sm/6 font-semibold text-gray-900"
          >
            First name
          </label>
          <div className="mt-2.5">
            <input
              id="first_name"
              name="first_name"
              type="text"
              autoComplete="given-name"
              required
              disabled={isPending}
              aria-invalid={Boolean(fieldErrors.first_name)}
              defaultValue={state?.values?.first_name ?? ""}
              className="block w-full rounded-md bg-white px-3.5 py-2 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 disabled:opacity-50"
            />
          </div>
          <FieldError error={fieldErrors.first_name} />
        </div>
        <div>
          <label
            htmlFor="last_name"
            className="block text-sm/6 font-semibold text-gray-900"
          >
            Last name
          </label>
          <div className="mt-2.5">
            <input
              id="last_name"
              name="last_name"
              type="text"
              autoComplete="family-name"
              required
              disabled={isPending}
              aria-invalid={Boolean(fieldErrors.last_name)}
              defaultValue={state?.values?.last_name ?? ""}
              className="block w-full rounded-md bg-white px-3.5 py-2 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 disabled:opacity-50"
            />
          </div>
          <FieldError error={fieldErrors.last_name} />
        </div>
        <div className="sm:col-span-2">
          <label
            htmlFor="email"
            className="block text-sm/6 font-semibold text-gray-900"
          >
            Email
          </label>
          <div className="mt-2.5">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              disabled={isPending}
              aria-invalid={Boolean(fieldErrors.email)}
              defaultValue={state?.values?.email ?? ""}
              className="block w-full rounded-md bg-white px-3.5 py-2 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 disabled:opacity-50"
            />
          </div>
          <FieldError error={fieldErrors.email} />
        </div>
        <div className="sm:col-span-2">
          <label
            htmlFor="subject"
            className="block text-sm/6 font-semibold text-gray-900"
          >
            Subject
          </label>
          <div className="mt-2.5">
            <input
              id="subject"
              name="subject"
              type="text"
              required
              disabled={isPending}
              aria-invalid={Boolean(fieldErrors.subject)}
              defaultValue={state?.values?.subject ?? ""}
              className="block w-full rounded-md bg-white px-3.5 py-2 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 disabled:opacity-50"
            />
          </div>
          <FieldError error={fieldErrors.subject} />
        </div>
        <div className="sm:col-span-2">
          <label
            htmlFor="message"
            className="block text-sm/6 font-semibold text-gray-900"
          >
            Message
          </label>
          <div className="mt-2.5">
            <textarea
              id="message"
              name="message"
              rows={4}
              required
              disabled={isPending}
              aria-invalid={Boolean(fieldErrors.message)}
              defaultValue={state?.values?.message ?? ""}
              className="block w-full rounded-md bg-white px-3.5 py-2 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 disabled:opacity-50"
            />
          </div>
          <FieldError error={fieldErrors.message} />
        </div>
      </div>
      <div className="mt-10">
        <button
          type="submit"
          disabled={isPending}
          className="block w-full rounded-md bg-indigo-600 px-3.5 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-indigo-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
        >
          {isPending ? "Sending..." : "Send message"}
        </button>
      </div>
    </form>
  );
}
