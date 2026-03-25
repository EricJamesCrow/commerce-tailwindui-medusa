import Image from "next/image";
import { Suspense } from "react";
import FooterCopyright from "./footer-copyright";
import { FooterNavigation } from "./footer-navigation";
import { FooterSocialLinks } from "./footer-social-links";
import { FooterNewsletter } from "./footer-newsletter";
import { retrieveCustomer } from "lib/medusa/customer";

const { COMPANY_NAME } = process.env;

// Loading skeleton for navigation sections
const NavigationSkeleton = () => (
  <div className="col-span-6 mt-10 grid grid-cols-2 gap-8 sm:grid-cols-3 md:col-span-8 md:col-start-3 md:row-start-1 md:mt-0 lg:col-span-6 lg:col-start-2">
    <div className="grid grid-cols-1 gap-y-12 sm:col-span-2 sm:grid-cols-2 sm:gap-x-8">
      <div className="space-y-6">
        <div className="h-4 w-20 animate-pulse rounded-sm bg-gray-200" />
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-3 w-24 animate-pulse rounded-sm bg-gray-200"
            />
          ))}
        </div>
      </div>
      <div className="space-y-6">
        <div className="h-4 w-20 animate-pulse rounded-sm bg-gray-200" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-3 w-24 animate-pulse rounded-sm bg-gray-200"
            />
          ))}
        </div>
      </div>
    </div>
    <div className="space-y-6">
      <div className="h-4 w-12 animate-pulse rounded-sm bg-gray-200" />
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-3 w-24 animate-pulse rounded-sm bg-gray-200"
          />
        ))}
      </div>
    </div>
  </div>
);

async function NewsletterWithCustomer() {
  const customer = await retrieveCustomer().catch(() => null);
  return <FooterNewsletter customerEmail={customer?.email} />;
}

export default function Footer() {
  return (
    <footer aria-labelledby="footer-heading" className="bg-white">
      <h2 id="footer-heading" className="sr-only">
        Footer
      </h2>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="border-t border-gray-200 py-20">
          <div className="grid grid-cols-1 md:grid-flow-col md:auto-rows-min md:grid-cols-12 md:gap-x-8 md:gap-y-16">
            {/* Image section */}
            <div className="col-span-1 md:col-span-2 lg:col-start-1 lg:row-start-1">
              <Image
                alt=""
                src="https://tailwindcss.com/plus-assets/img/logos/mark.svg?color=indigo&shade=600"
                width={32}
                height={32}
                className="h-8 w-auto"
              />
            </div>

            {/* Sitemap sections with Suspense */}
            <Suspense fallback={<NavigationSkeleton />}>
              <FooterNavigation />
            </Suspense>

            {/* Newsletter section */}
            <Suspense fallback={<FooterNewsletter />}>
              <NewsletterWithCustomer />
            </Suspense>
          </div>
        </div>

        <div className="border-t border-gray-100 py-10 text-center">
          <FooterSocialLinks />
          <Suspense
            fallback={
              <div className="h-4 w-20 animate-pulse rounded-sm bg-gray-200" />
            }
          >
            <FooterCopyright companyName={COMPANY_NAME} />
          </Suspense>
        </div>
      </div>
    </footer>
  );
}
