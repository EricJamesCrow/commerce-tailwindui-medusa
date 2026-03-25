import Link from "next/link";

export default function NotFound() {
  return (
    <main className="relative isolate min-h-[calc(100vh-200px)]">
      <img
        alt=""
        src="/images/404-background.svg"
        className="absolute inset-0 -z-10 size-full object-cover object-top"
      />
      <div className="mx-auto max-w-7xl px-6 py-32 text-center sm:py-40 lg:px-8">
        <p className="text-base/8 font-semibold text-white">404</p>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight text-balance text-white sm:text-7xl">
          Page not found
        </h1>
        <p className="mt-6 text-lg font-medium text-pretty text-white/70 sm:text-xl/8">
          Sorry, we couldn&apos;t find the page you&apos;re looking for.
        </p>
        <div className="mt-10 flex justify-center">
          <Link
            href="/"
            className="text-sm/7 font-semibold text-white hover:text-white/90"
          >
            <span aria-hidden="true">&larr;</span> Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
