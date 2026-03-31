import Image from "next/image";
import type { ReactNode } from "react";

type AuthLayoutProps = {
  heading: string;
  subtext: ReactNode;
  children: ReactNode;
};

export function AuthLayout({ heading, subtext, children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-full bg-neutral-50 text-gray-900">
      <div className="flex flex-1 flex-col justify-center bg-neutral-50 px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div>
            <Image
              src="https://tailwindcss.com/plus-assets/img/logos/mark.svg?color=indigo&shade=600"
              alt="Your Company"
              width={40}
              height={40}
              className="h-10 w-auto"
            />
            <h2 className="mt-8 text-2xl/9 font-bold tracking-tight text-gray-900">
              {heading}
            </h2>
            <p className="mt-2 text-sm/6 text-gray-500">{subtext}</p>
          </div>

          <div className="mt-10">{children}</div>
        </div>
      </div>
      <div className="relative hidden w-0 flex-1 lg:block">
        <Image
          src="https://images.unsplash.com/photo-1496917756835-20cb06e75b4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=1908&q=80"
          alt=""
          fill
          sizes="50vw"
          className="object-cover"
        />
      </div>
    </div>
  );
}
