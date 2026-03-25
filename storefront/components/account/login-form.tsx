"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "lib/medusa/customer";

export function LoginForm() {
  const [error, formAction, isPending] = useActionState(login, null);

  return (
    <form action={formAction} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div>
        <label
          htmlFor="email"
          className="block text-sm/6 font-medium text-gray-900"
        >
          Email address
        </label>
        <div className="mt-2">
          <input
            id="email"
            type="email"
            name="email"
            required
            autoComplete="email"
            className="focus:outline-primary-600 block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 sm:text-sm/6"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm/6 font-medium text-gray-900"
        >
          Password
        </label>
        <div className="mt-2">
          <input
            id="password"
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className="focus:outline-primary-600 block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 sm:text-sm/6"
          />
        </div>
      </div>

      <div className="flex items-center justify-end">
        <Link
          href="/account/forgot-password"
          className="text-primary-600 hover:text-primary-500 text-sm/6 font-semibold"
        >
          Forgot password?
        </Link>
      </div>

      <div>
        <button
          type="submit"
          disabled={isPending}
          className="bg-primary-600 hover:bg-primary-500 focus-visible:outline-primary-600 flex w-full justify-center rounded-md px-3 py-1.5 text-sm/6 font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Signing in..." : "Sign in"}
        </button>
      </div>
    </form>
  );
}
