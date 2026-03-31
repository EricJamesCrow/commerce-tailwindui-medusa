"use client";

import * as Sentry from "@sentry/nextjs";
import {
  ArrowPathIcon,
  ChatBubbleLeftRightIcon,
  ExclamationTriangleIcon,
  HomeIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
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
    Sentry.withScope((scope) => {
      scope.setTag("error_boundary", "global");

      if (error.digest) {
        scope.setTag("error_digest", error.digest);
      }

      scope.setExtra("message", error.message);
      Sentry.captureException(error);
    });
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-white text-gray-900 antialiased">
        <main className="relative isolate min-h-screen overflow-hidden bg-white">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.14),_transparent_58%)]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-y-0 right-0 -z-10 hidden w-1/2 bg-[linear-gradient(to_bottom,_rgba(243,244,246,0.9),_rgba(255,255,255,0))] lg:block"
          />

          <div className="mx-auto flex min-h-screen max-w-7xl items-center px-6 py-16 sm:py-20 lg:px-8">
            <div className="grid w-full gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,26rem)] lg:items-center">
              <section className="max-w-2xl">
                <div className="inline-flex items-center gap-3 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-sm">
                  <ExclamationTriangleIcon
                    aria-hidden="true"
                    className="text-primary-600 size-5"
                  />
                  <span className="text-sm font-semibold text-gray-700">
                    Storefront recovery
                  </span>
                </div>

                <h1 className="mt-8 text-4xl font-semibold tracking-tight text-balance text-gray-950 sm:text-6xl">
                  We hit an unexpected issue before this page could finish
                  loading.
                </h1>
                <p className="mt-6 max-w-xl text-lg/8 text-gray-600 sm:text-xl/8">
                  The error has been reported automatically. Retry the request,
                  return to the storefront, or jump back into browsing while we
                  recover in the background.
                </p>

                <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => reset()}
                    className="bg-primary-600 hover:bg-primary-500 focus-visible:outline-primary-600 inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-5 py-3 text-sm font-semibold text-white shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    <ArrowPathIcon aria-hidden="true" className="size-5" />
                    Try again
                  </button>
                  <Link
                    href="/"
                    className="focus-visible:outline-primary-600 inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-900 shadow-sm transition hover:border-gray-400 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    <HomeIcon aria-hidden="true" className="size-5" />
                    Back to home
                  </Link>
                  <Link
                    href="/products"
                    className="focus-visible:outline-primary-600 inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-transparent px-2 py-3 text-sm font-semibold text-gray-700 transition hover:text-gray-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    <Squares2X2Icon aria-hidden="true" className="size-5" />
                    Browse products
                  </Link>
                </div>

                <dl className="mt-12 grid gap-4 border-t border-gray-200 pt-8 text-sm text-gray-600 sm:grid-cols-3">
                  <div>
                    <dt className="font-semibold text-gray-950">
                      What happened
                    </dt>
                    <dd className="mt-2 leading-6">
                      A rendering failure interrupted the current request before
                      the normal storefront shell could mount.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-gray-950">What we did</dt>
                    <dd className="mt-2 leading-6">
                      Logged the exception to Sentry with the available request
                      digest for follow-up.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-gray-950">
                      What you can do
                    </dt>
                    <dd className="mt-2 leading-6">
                      Retry now, continue shopping, or contact support if the
                      issue keeps repeating.
                    </dd>
                  </div>
                </dl>
              </section>

              <aside className="rounded-3xl border border-gray-200 bg-white/95 p-6 shadow-[0_20px_80px_-40px_rgba(15,23,42,0.35)] backdrop-blur sm:p-8">
                <div className="flex items-start gap-4">
                  <div className="bg-primary-50 rounded-2xl p-3">
                    <ExclamationTriangleIcon
                      aria-hidden="true"
                      className="text-primary-600 size-6"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-semibold tracking-[0.18em] text-gray-500 uppercase">
                      Recovery options
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-gray-950">
                      Keep this reference if you need support
                    </h2>
                  </div>
                </div>

                <div className="mt-8 space-y-4">
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-xs font-semibold tracking-[0.18em] text-gray-500 uppercase">
                      Error reference
                    </p>
                    <p className="mt-2 font-mono text-sm break-all text-gray-700">
                      {error.digest ?? "Unavailable for this request"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-gray-200 p-4">
                    <p className="text-sm font-semibold text-gray-950">
                      Fastest recovery
                    </p>
                    <p className="mt-2 text-sm/6 text-gray-600">
                      Retry first. If the error persists, return home or reopen
                      the product grid from a clean request.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-gray-200 p-4">
                    <p className="text-sm font-semibold text-gray-950">
                      Need help from our team?
                    </p>
                    <p className="mt-2 text-sm/6 text-gray-600">
                      Share the reference above so support can match your report
                      to the captured exception.
                    </p>
                    <Link
                      href="/contact"
                      className="text-primary-600 hover:text-primary-500 focus-visible:outline-primary-600 mt-4 inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      <ChatBubbleLeftRightIcon
                        aria-hidden="true"
                        className="size-5"
                      />
                      Contact support
                    </Link>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
