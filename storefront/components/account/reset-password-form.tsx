"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { completePasswordReset } from "lib/medusa/customer";
import { MIN_PASSWORD_LENGTH, validatePassword } from "lib/validation";

type ResetPasswordFormProps = { token: string; email: string };

export function ResetPasswordForm({ token, email }: ResetPasswordFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirm_password") as string;
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await completePasswordReset(token, email, password);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
      }
    });
  }

  if (success) {
    return (
      <div className="space-y-6">
        <div className="rounded-md bg-green-50 p-4">
          <p className="text-sm text-green-800">
            Your password has been reset successfully.
          </p>
        </div>
        <Link
          href="/account/login"
          className="bg-primary-600 hover:bg-primary-500 focus-visible:outline-primary-600 flex w-full justify-center rounded-md px-3 py-1.5 text-sm/6 font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
      <div>
        <label
          htmlFor="password"
          className="block text-sm/6 font-medium text-gray-900"
        >
          New password
        </label>
        <div className="mt-2">
          <input
            id="password"
            type="password"
            name="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            className="focus:outline-primary-600 block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 sm:text-sm/6"
          />
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Must be at least {MIN_PASSWORD_LENGTH} characters
        </p>
      </div>
      <div>
        <label
          htmlFor="confirm_password"
          className="block text-sm/6 font-medium text-gray-900"
        >
          Confirm new password
        </label>
        <div className="mt-2">
          <input
            id="confirm_password"
            type="password"
            name="confirm_password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            className="focus:outline-primary-600 block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 sm:text-sm/6"
          />
        </div>
      </div>
      <div>
        <button
          type="submit"
          disabled={isPending}
          className="bg-primary-600 hover:bg-primary-500 focus-visible:outline-primary-600 flex w-full justify-center rounded-md px-3 py-1.5 text-sm/6 font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Resetting..." : "Reset password"}
        </button>
      </div>
    </form>
  );
}
