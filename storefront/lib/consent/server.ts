import "server-only";
import { cookies } from "next/headers";
import {
  DEFAULT_STOREFRONT_CONSENT,
  STOREFRONT_CONSENT_COOKIE,
  type StorefrontConsentState,
  parseStorefrontConsentCookie,
} from "./shared";

export async function getStorefrontConsentState(): Promise<StorefrontConsentState> {
  const cookieStore = await cookies();

  return parseStorefrontConsentCookie(
    cookieStore.get(STOREFRONT_CONSENT_COOKIE)?.value,
  );
}

export async function hasServerAnalyticsConsent(): Promise<boolean> {
  const consent = await getStorefrontConsentState();
  return consent.analytics === "granted";
}

export { DEFAULT_STOREFRONT_CONSENT };
