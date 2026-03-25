import "server-only";
import { cookies as nextCookies, headers as nextHeaders } from "next/headers";

const PH_ANON_COOKIE = "_ph_anon_id";
const PH_ANON_HEADER = "x-ph-anon-id";

export async function getPostHogAnonId(): Promise<string | undefined> {
  const cookieStore = await nextCookies();
  const fromCookie = cookieStore.get(PH_ANON_COOKIE)?.value;
  if (fromCookie) return fromCookie;

  // First request: cookie not yet in request, but proxy.ts set it as a header
  const headerStore = await nextHeaders();
  return headerStore.get(PH_ANON_HEADER) || undefined;
}

export async function removePostHogAnonId(): Promise<void> {
  const cookieStore = await nextCookies();
  cookieStore.set(PH_ANON_COOKIE, "", { maxAge: -1 });
}
