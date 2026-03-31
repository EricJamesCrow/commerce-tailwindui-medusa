import { siteBrand } from "@repo/site-config";
import { GeistSans } from "geist/font/sans";
import { baseUrl } from "lib/utils";
import { Metadata } from "next";
import { ReactNode, Suspense } from "react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import "./globals.css";

import { CartProvider } from "components/cart/cart-context";
import { AttributionPersistence } from "components/consent/attribution-persistence";
import { StorefrontConsentProvider } from "components/consent/consent-provider";
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
import { getStorefrontConsentState } from "lib/consent/server";
import { getFeatureFlags } from "lib/feature-flags";
import { WebVitals } from "./web-vitals";
import { getCart } from "lib/medusa";
import { retrieveCustomer } from "lib/medusa/customer";
import { isStorefrontConsentFoundationEnabled } from "lib/consent/shared";
import { getPostHogAnonId } from "lib/posthog-cookies";

const siteName = process.env.SITE_NAME?.trim() || siteBrand.siteName;

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  robots: {
    follow: true,
    index: true,
  },
};

async function AppProviders({ children }: { children: ReactNode }) {
  const cartPromise = getCart();
  const customer = await retrieveCustomer();
  const consentFoundationEnabled = isStorefrontConsentFoundationEnabled();
  const consent = consentFoundationEnabled
    ? await getStorefrontConsentState()
    : null;
  const analyticsEnabled = consentFoundationEnabled
    ? consent?.analytics === "granted"
    : true;
  const anonId =
    analyticsEnabled || !consentFoundationEnabled
      ? await getPostHogAnonId()
      : undefined;
  const distinctId = customer?.id || anonId || null;
  const bootstrapFlags = distinctId ? await getFeatureFlags(distinctId) : {};

  const appShell = (
    <PostHogProvider
      analyticsEnabled={analyticsEnabled}
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
        </SearchProvider>
      </NotificationProvider>
    </PostHogProvider>
  );

  return (
    <CartProvider cartPromise={cartPromise}>
      {consentFoundationEnabled && consent ? (
        <StorefrontConsentProvider initialConsent={consent}>
          <AttributionPersistence />
          {appShell}
        </StorefrontConsentProvider>
      ) : (
        <>
          <AttributionPersistence />
          {appShell}
        </>
      )}
    </CartProvider>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={siteBrand.locale} className={GeistSans.variable}>
      <body className={siteBrand.bodyClassName}>
        <NuqsAdapter>
          <Suspense>
            <AppProviders>{children}</AppProviders>
          </Suspense>
        </NuqsAdapter>
      </body>
    </html>
  );
}
