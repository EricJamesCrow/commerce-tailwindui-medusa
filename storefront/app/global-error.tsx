"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-white">
        <main className="isolate min-h-screen bg-linear-to-b from-white via-gray-50 to-gray-100 px-6 py-24 sm:py-32">
          <div className="mx-auto max-w-3xl">
            <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-[0_20px_80px_-40px_rgba(15,23,42,0.35)]">
              <div className="border-b border-gray-100 px-6 py-4 sm:px-8">
                <p className="text-primary-600 text-sm font-semibold tracking-[0.18em] uppercase">
                  Storefront Error
                </p>
              </div>
              <div className="space-y-6 px-6 py-10 sm:px-8 sm:py-12">
                <div className="space-y-3">
                  <h1 className="text-3xl font-semibold tracking-tight text-gray-950 sm:text-4xl">
                    Something went wrong
                  </h1>
                  <p className="max-w-2xl text-base leading-7 text-gray-600">
                    We hit an unexpected error while rendering this page. You
                    can retry the request or head back to the storefront home
                    page.
                  </p>
                </div>

                {error.digest ? (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                    <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">
                      Error reference
                    </p>
                    <p className="mt-1 font-mono text-sm text-gray-700">
                      {error.digest}
                    </p>
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => reset()}
                    className="bg-primary-600 hover:bg-primary-700 inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold text-white transition"
                  >
                    Try again
                  </button>
                  <Link
                    href="/"
                    className="inline-flex items-center justify-center rounded-full border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-gray-400 hover:text-gray-900"
                  >
                    Back to home
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
