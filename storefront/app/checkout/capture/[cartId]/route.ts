import { NextRequest, NextResponse } from "next/server";
import { completeCart } from "lib/medusa/checkout";
import { getCartId } from "lib/medusa/cookies";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ cartId: string }> },
) {
  const { cartId } = await params;
  const origin = req.nextUrl.origin;

  // Verify the cart belongs to the current session to prevent unauthorized completion
  const sessionCartId = await getCartId();
  if (!sessionCartId || sessionCartId !== cartId) {
    return NextResponse.redirect(`${origin}/checkout?error=invalid_session`);
  }

  // Always attempt cart completion — Medusa validates payment status server-side
  // via the Stripe provider. Never trust redirect_status or other query params.
  let result;
  try {
    result = await Promise.race([
      completeCart(cartId),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 30_000),
      ),
    ]);
  } catch {
    return NextResponse.redirect(`${origin}/checkout?error=payment_failed`);
  }

  if (result.type === "order") {
    return NextResponse.redirect(
      `${origin}/order/confirmed/${result.order.id}`,
    );
  }

  if (result.error) {
    console.error("[Capture] Cart completion failed:", result.error);
  }
  return NextResponse.redirect(`${origin}/checkout?error=payment_failed`);
}
