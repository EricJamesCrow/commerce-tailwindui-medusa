import "server-only"
import { cookies as nextCookies } from "next/headers"

const PH_ANON_COOKIE = "_ph_anon_id"

export async function getPostHogAnonId(): Promise<string | undefined> {
  const cookies = await nextCookies()
  return cookies.get(PH_ANON_COOKIE)?.value
}

export async function removePostHogAnonId(): Promise<void> {
  const cookies = await nextCookies()
  cookies.set(PH_ANON_COOKIE, "", { maxAge: -1 })
}
