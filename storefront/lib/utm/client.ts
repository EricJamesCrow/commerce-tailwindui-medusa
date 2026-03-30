import {
  STOREFRONT_ATTRIBUTION_COOKIE,
  STOREFRONT_ATTRIBUTION_COOKIE_MAX_AGE,
  type PersistedAttribution,
  parsePersistedAttributionCookie,
  serializePersistedAttributionCookie,
} from "./shared";

function getCookieValue(name: string, cookieSource: string): string | null {
  const match = cookieSource.match(
    new RegExp(
      `(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`,
    ),
  );

  return match?.[1] ?? null;
}

export function readPersistedAttributionFromDocument(): PersistedAttribution | null {
  if (typeof document === "undefined") return null;

  return parsePersistedAttributionCookie(
    getCookieValue(STOREFRONT_ATTRIBUTION_COOKIE, document.cookie),
  );
}

export function persistAttributionToDocument(
  attribution: PersistedAttribution | null,
): void {
  if (typeof document === "undefined") return;

  const serialized = serializePersistedAttributionCookie(attribution);
  const secure = window.location.protocol === "https:" ? "; Secure" : "";

  if (!serialized) {
    document.cookie = `${STOREFRONT_ATTRIBUTION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
    return;
  }

  document.cookie = `${STOREFRONT_ATTRIBUTION_COOKIE}=${serialized}; Path=/; Max-Age=${STOREFRONT_ATTRIBUTION_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}
