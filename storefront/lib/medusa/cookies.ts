import "server-only";
import { cookies as nextCookies } from "next/headers";
import {
  getExpiredNewsletterUnsubscribeCookieOptions,
  getNewsletterUnsubscribeCookieName,
  isValidNewsletterUnsubscribeFlowId,
} from "../newsletter-unsubscribe-cookie";

// --- Cart Cookie ---

const CART_COOKIE = "_medusa_cart_id";

export async function getCartId(): Promise<string | undefined> {
  const cookies = await nextCookies();
  return cookies.get(CART_COOKIE)?.value;
}

export async function setCartId(cartId: string): Promise<void> {
  const cookies = await nextCookies();
  cookies.set(CART_COOKIE, cartId, {
    maxAge: 60 * 60 * 24 * 30, // 30 days
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function removeCartId(): Promise<void> {
  const cookies = await nextCookies();
  cookies.set(CART_COOKIE, "", { maxAge: -1 });
}

// --- Auth Token (infrastructure for customer accounts) ---

const AUTH_COOKIE = "_medusa_jwt";

export async function getAuthToken(): Promise<string | undefined> {
  const cookies = await nextCookies();
  return cookies.get(AUTH_COOKIE)?.value;
}

export async function setAuthToken(token: string): Promise<void> {
  const cookies = await nextCookies();
  cookies.set(AUTH_COOKIE, token, {
    maxAge: 60 * 60 * 24 * 7, // 7 days
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function removeAuthToken(): Promise<void> {
  const cookies = await nextCookies();
  cookies.set(AUTH_COOKIE, "", { maxAge: -1 });
}

// --- Wishlist Cookie (guest wishlist ID) ---

const WISHLIST_COOKIE = "_medusa_wishlist_id";

export async function getWishlistId(): Promise<string | undefined> {
  const cookies = await nextCookies();
  return cookies.get(WISHLIST_COOKIE)?.value;
}

export async function setWishlistId(wishlistId: string): Promise<void> {
  const cookies = await nextCookies();
  cookies.set(WISHLIST_COOKIE, wishlistId, {
    maxAge: 60 * 60 * 24 * 30, // 30 days
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function removeWishlistId(): Promise<void> {
  const cookies = await nextCookies();
  cookies.set(WISHLIST_COOKIE, "", { maxAge: -1 });
}

// --- Newsletter Unsubscribe Token ---

export async function getNewsletterUnsubscribeToken(
  flowId: string | null | undefined,
): Promise<string | undefined> {
  if (!isValidNewsletterUnsubscribeFlowId(flowId)) {
    return undefined;
  }

  const cookies = await nextCookies();
  return cookies.get(getNewsletterUnsubscribeCookieName(flowId))?.value;
}

export async function removeNewsletterUnsubscribeToken(
  flowId: string | null | undefined,
): Promise<void> {
  if (!isValidNewsletterUnsubscribeFlowId(flowId)) {
    return;
  }

  const cookies = await nextCookies();
  cookies.set(
    getNewsletterUnsubscribeCookieName(flowId),
    "",
    getExpiredNewsletterUnsubscribeCookieOptions(),
  );
}

// --- Auth Headers ---

export async function getAuthHeaders(): Promise<
  { authorization: string } | Record<string, never>
> {
  const token = await getAuthToken();
  if (!token) return {};
  return { authorization: `Bearer ${token}` };
}

// --- Cache Isolation (infrastructure for per-user caching) ---

const CACHE_COOKIE = "_medusa_cache_id";

export async function getCacheTag(tag: string): Promise<string> {
  try {
    const cookies = await nextCookies();
    const cacheId = cookies.get(CACHE_COOKIE)?.value;
    if (!cacheId) return "";
    return `${tag}-${cacheId}`;
  } catch {
    return "";
  }
}

export async function getCacheOptions(
  tag: string,
): Promise<{ tags: string[] } | Record<string, never>> {
  const cacheTag = await getCacheTag(tag);
  if (!cacheTag) return {};
  return { tags: [cacheTag] };
}
