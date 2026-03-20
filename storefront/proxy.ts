import { NextResponse, type NextRequest } from "next/server"
import { randomUUID } from "node:crypto"

const PH_ANON_COOKIE = "_ph_anon_id"
export const PH_ANON_HEADER = "x-ph-anon-id"

export function proxy(request: NextRequest): NextResponse {
  const existingId = request.cookies.get(PH_ANON_COOKIE)?.value
  const anonId = existingId || randomUUID()

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(PH_ANON_HEADER, anonId)

  const response = NextResponse.next({ request: { headers: requestHeaders } })

  if (!existingId) {
    response.cookies.set(PH_ANON_COOKIE, anonId, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
    })
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
