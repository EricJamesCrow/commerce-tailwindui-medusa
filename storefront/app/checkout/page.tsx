import { redirect } from "next/navigation";
import { getCheckoutCart } from "lib/medusa/checkout";
import { retrieveCustomer } from "lib/medusa/customer";
import { trackServer } from "lib/analytics-server";
import { CheckoutForm } from "components/checkout/checkout-form";
import { OrderSummary } from "components/checkout/order-summary";

export const metadata = {
  title: "Checkout",
};

export default async function CheckoutPage() {
  const cart = await getCheckoutCart();

  if (!cart || !cart.items?.length) {
    redirect("/");
  }

  try {
    await trackServer("checkout_started", {
      cart_id: cart.id,
      item_count: cart.items?.length ?? 0,
      cart_total: cart.total ?? 0,
    });
  } catch {}

  const customer = await retrieveCustomer();

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-7xl px-4 pt-4 pb-16 sm:px-6 sm:pt-8 sm:pb-24 lg:px-8 xl:px-2 xl:pt-14">
        <h1 className="sr-only">Checkout</h1>

        <div className="mx-auto grid max-w-lg grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-2">
          <div className="mx-auto w-full max-w-lg">
            <OrderSummary cart={cart} />
          </div>

          <div className="mx-auto w-full max-w-lg">
            <CheckoutForm cart={cart} customer={customer} />
          </div>
        </div>
      </div>
    </div>
  );
}
