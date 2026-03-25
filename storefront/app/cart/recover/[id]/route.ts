import * as Sentry from "@sentry/nextjs";
import { createHmac, timingSafeEqual } from "node:crypto";
import { setCartId } from "lib/medusa/cookies";
import { sdk } from "lib/medusa";
import { trackServer } from "lib/analytics-server";
import type { HttpTypes } from "@medusajs/types";
import { NextRequest, NextResponse } from "next/server";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const token = request.nextUrl.searchParams.get("token");

  // Validate required params
  if (!id || !token) {
    return new NextResponse(null, { status: 404 });
  }

  // Verify HMAC token
  const secret = process.env.CART_RECOVERY_SECRET;
  if (!secret) {
    console.error("CART_RECOVERY_SECRET is not set");
    return new NextResponse(null, { status: 404 });
  }

  const expectedToken = createHmac("sha256", secret).update(id).digest("hex");

  // Timing-safe comparison to prevent timing attacks
  let isValid = false;
  try {
    isValid = timingSafeEqual(
      Buffer.from(token, "hex"),
      Buffer.from(expectedToken, "hex"),
    );
  } catch {
    // Buffer lengths don't match — invalid token
    isValid = false;
  }

  if (!isValid) {
    return new NextResponse(null, { status: 404 });
  }

  // Verify the cart still exists and isn't completed
  let recoveredCart: HttpTypes.StoreCart | null = null;
  try {
    const { cart } = await sdk.client.fetch<{ cart: HttpTypes.StoreCart }>(
      `/store/carts/${id}`,
      { method: "GET" },
    );
    if (!cart || cart.completed_at) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    recoveredCart = cart;
  } catch (e) {
    Sentry.captureException(e, {
      tags: { action: "cart_recovery", cart_id: id },
      level: "warning",
    });
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Token is valid, cart exists — restore the cart session
  await setCartId(id);

  try {
    await trackServer("abandoned_cart_recovered", {
      cart_id: id,
      item_count: recoveredCart.items?.length ?? 0,
    });
  } catch {}

  // Redirect to homepage — the cart is a drawer (no /cart page exists)
  return NextResponse.redirect(new URL("/", request.url));
}
