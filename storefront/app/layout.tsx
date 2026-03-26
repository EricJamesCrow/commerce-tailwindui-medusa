import { GeistSans } from "geist/font/sans";
import { baseUrl } from "lib/utils";
import { Metadata } from "next";
import { ReactNode, Suspense } from "react";
import "./globals.css";

import { CartProvider } from "components/cart/cart-context";
import { DiscountPopup } from "components/common/discount-popup";
import Footer from "components/layout/footer";
import { Incentives } from "components/layout/incentives";
import { Navbar } from "components/layout/navbar";
import {
  NotificationContainer,
  NotificationProvider,
} from "components/notifications";
import { PostHogProvider } from "components/providers/posthog-provider";
import { SentryUserProvider } from "components/providers/sentry-user-provider";
import { SearchDialog, SearchProvider } from "components/search-command";
import { getFeatureFlags } from "lib/feature-flags";
import { WebVitals } from "./web-vitals";
import { getCart } from "lib/medusa";
import { retrieveCustomer } from "lib/medusa/customer";
import { getPostHogAnonId } from "lib/posthog-cookies";

const { SITE_NAME } = process.env;

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: SITE_NAME!,
    template: `%s | ${SITE_NAME}`,
  },
  robots: {
    follow: true,
    index: true,
  },
};

async function AppProviders({ children }: { children: ReactNode }) {
  const cartPromise = getCart();
  const customer = await retrieveCustomer();
  const anonId = await getPostHogAnonId();
  const distinctId = customer?.id || anonId || null;
  const bootstrapFlags = distinctId ? await getFeatureFlags(distinctId) : {};

  return (
    <CartProvider cartPromise={cartPromise}>
      <PostHogProvider
        bootstrapDistinctId={distinctId}
        bootstrapFlags={bootstrapFlags}
      >
        <SentryUserProvider customerId={customer?.id ?? null} />
        <WebVitals />
        <NotificationProvider>
          <SearchProvider>
            <NotificationContainer />
            <SearchDialog />
            <Navbar />
            <main>{children}</main>
            <Incentives />
            <Footer />
            <DiscountPopup isAuthenticated={!!customer} />
          </SearchProvider>
        </NotificationProvider>
      </PostHogProvider>
    </CartProvider>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body className="bg-neutral-50">
        <Suspense>
          <AppProviders>{children}</AppProviders>
        </Suspense>
      </body>
    </html>
  );
}
