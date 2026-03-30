import {
  DEFAULT_STOREFRONT_CONSENT,
  STOREFRONT_CONSENT_COOKIE,
  STOREFRONT_CONSENT_COOKIE_MAX_AGE,
  type StorefrontConsentState,
  parseStorefrontConsentCookie,
  serializeStorefrontConsentCookie,
} from "./shared";

function getCookieValue(name: string, cookieSource: string): string | null {
  const match = cookieSource.match(
    new RegExp(
      `(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`,
    ),
  );

  return match?.[1] ?? null;
}

export function readStorefrontConsentFromDocument(): StorefrontConsentState {
  if (typeof document === "undefined") return DEFAULT_STOREFRONT_CONSENT;

  return parseStorefrontConsentCookie(
    getCookieValue(STOREFRONT_CONSENT_COOKIE, document.cookie),
  );
}

export function persistStorefrontConsentToDocument(
  consent: StorefrontConsentState,
): void {
  if (typeof document === "undefined") return;

  const serialized = serializeStorefrontConsentCookie(consent);
  const secure = window.location.protocol === "https:" ? "; Secure" : "";

  if (!serialized) {
    document.cookie = `${STOREFRONT_CONSENT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
    return;
  }

  document.cookie = `${STOREFRONT_CONSENT_COOKIE}=${serialized}; Path=/; Max-Age=${STOREFRONT_CONSENT_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}
