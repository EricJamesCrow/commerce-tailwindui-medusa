"use server";

import type { HttpTypes } from "@medusajs/types";
import { STRIPE_PROVIDER_ID, TAGS } from "lib/constants";
import { sdk } from "lib/medusa";
import { getAuthHeaders, getCartId, removeCartId } from "lib/medusa/cookies";
import { medusaError } from "lib/medusa/error";
import { trackServer } from "lib/analytics-server";
import type {
  AddressPayload,
  CartCompletionResult,
  SavedPaymentMethod,
  ShippingOption,
} from "lib/types";
import { revalidatePath, revalidateTag } from "next/cache";

function revalidateCheckout(): void {
  revalidateTag(TAGS.cart, "max");
  revalidatePath("/", "layout");
}

async function assertSessionCart(cartId: string): Promise<void> {
  const sessionCartId = await getCartId();
  if (!sessionCartId || sessionCartId !== cartId) {
    throw new Error("Cart not found");
  }
}

// === Retrieve raw cart (not transformed) for checkout ===

export async function getCheckoutCart(): Promise<HttpTypes.StoreCart | null> {
  const cartId = await getCartId();
  if (!cartId) return null;

  const headers = await getAuthHeaders();

  try {
    const { cart } = await sdk.client.fetch<{
      cart: HttpTypes.StoreCart;
    }>(`/store/carts/${cartId}`, {
      method: "GET",
      headers,
      query: {
        fields:
          "*items,*items.product,*items.variant,*items.thumbnail,+items.total,*promotions,+shipping_methods.name,*payment_collection.payment_sessions",
      },
    }).catch(medusaError);
    return cart;
  } catch (error) {
    console.error("[checkout] Failed to fetch cart:", error);
    return null;
  }
}

// === Cart Email ===

export async function setCartEmail(
  cartId: string,
  email: string,
): Promise<string | null> {
  const headers = await getAuthHeaders();
  const normalizedEmail = email.trim().toLowerCase();

  try {
    await assertSessionCart(cartId);
    await sdk.store.cart
      .update(cartId, { email: normalizedEmail }, {}, headers)
      .catch(medusaError);
    try { await trackServer("checkout_step_completed", { step_name: "email", step_number: 1 }) } catch {}
  } catch (e) {
    return e instanceof Error ? e.message : "Error setting email";
  } finally {
    revalidateCheckout();
  }

  return null;
}

// === Addresses ===

export async function setCartAddresses(
  cartId: string,
  shipping: AddressPayload,
  billing?: AddressPayload,
): Promise<string | null> {
  const headers = await getAuthHeaders();
  const billingAddress = billing || shipping;

  try {
    await assertSessionCart(cartId);
    await sdk.store.cart
      .update(
        cartId,
        {
          shipping_address: shipping,
          billing_address: billingAddress,
        },
        {},
        headers,
      )
      .catch(medusaError);
    try { await trackServer("checkout_step_completed", { step_name: "address", step_number: 2 }) } catch {}
  } catch (e) {
    return e instanceof Error ? e.message : "Error setting addresses";
  } finally {
    revalidateCheckout();
  }

  return null;
}

// === Shipping Options ===

export async function getShippingOptions(
  cartId: string,
): Promise<ShippingOption[]> {
  const headers = await getAuthHeaders();

  try {
    const { shipping_options } = await sdk.client.fetch<{
      shipping_options: Array<{
        id: string;
        name: string;
        price_type?: string;
        amount?: number;
        currency_code?: string;
      }>;
    }>("/store/shipping-options", {
      method: "GET",
      headers,
      query: { cart_id: cartId },
    }).catch(medusaError);

    return shipping_options.map((opt) => ({
      id: opt.id,
      name: opt.name,
      price_type: (opt.price_type || "flat") as ShippingOption["price_type"],
      amount: opt.amount ?? 0,
      currency_code: opt.currency_code || "USD",
    }));
  } catch (error) {
    console.error("[checkout] Failed to fetch shipping options:", error);
    return [];
  }
}

export async function setShippingMethod(
  cartId: string,
  optionId: string,
): Promise<string | null> {
  const headers = await getAuthHeaders();

  try {
    await assertSessionCart(cartId);
    await sdk.store.cart
      .addShippingMethod(cartId, { option_id: optionId }, {}, headers)
      .catch(medusaError);
    try { await trackServer("checkout_step_completed", { step_name: "shipping", step_number: 3 }) } catch {}
  } catch (e) {
    return e instanceof Error ? e.message : "Error setting shipping method";
  } finally {
    revalidateCheckout();
  }

  return null;
}

// === Payment ===

export async function initializePaymentSession(
  cartId: string,
  providerId: string,
  data?: Record<string, unknown>,
): Promise<string | null> {
  const headers = await getAuthHeaders();

  try {
    await assertSessionCart(cartId);
    const { cart } = await sdk.client.fetch<{
      cart: HttpTypes.StoreCart;
    }>(`/store/carts/${cartId}`, {
      method: "GET",
      headers,
      query: { fields: "*payment_collection.payment_sessions" },
    }).catch(medusaError);

    await sdk.store.payment
      .initiatePaymentSession(cart, { provider_id: providerId, data }, {}, headers)
      .catch(medusaError);
    try { await trackServer("checkout_step_completed", { step_name: "payment", step_number: 4 }) } catch {}
  } catch (e) {
    return e instanceof Error ? e.message : "Error initializing payment";
  } finally {
    revalidateCheckout();
  }

  return null;
}

// === Saved Payment Methods ===

export async function getSavedPaymentMethods(
  accountHolderId: string,
): Promise<SavedPaymentMethod[]> {
  const headers = await getAuthHeaders();

  try {
    const { payment_methods } = await sdk.client.fetch<{
      payment_methods: SavedPaymentMethod[];
    }>(`/store/payment-methods/${accountHolderId}`, {
      method: "GET",
      headers,
    }).catch(medusaError);
    return payment_methods;
  } catch (error) {
    console.error("[checkout] Failed to fetch saved payment methods:", error);
    return [];
  }
}

// === Complete Cart ===

export async function completeCart(
  cartId: string,
): Promise<CartCompletionResult> {
  const headers = await getAuthHeaders();

  try {
    await assertSessionCart(cartId);
    const result = await sdk.store.cart
      .complete(cartId, {}, headers)
      .catch(medusaError);

    if (result.type === "order") {
      await removeCartId();
      try {
        await trackServer("checkout_step_completed", { step_name: "review", step_number: 5 })
        await trackServer("order_completed", {
          order_id: result.order.id,
          order_total: result.order.total || 0,
          item_count: result.order.items?.length || 0,
          currency_code: result.order.currency_code || "usd",
        })
      } catch {}
      return { type: "order", order: result.order };
    }

    return {
      type: "cart",
      error:
        (typeof result.error === "string"
          ? result.error
          : result.error?.message) || "Payment could not be completed",
    };
  } catch (err) {
    return {
      type: "cart",
      error: err instanceof Error ? err.message : "Error completing order",
    };
  } finally {
    revalidateCheckout();
  }
}

// === Express Checkout Composite ===

/**
 * Chains all steps needed for express checkout (Apple Pay / Google Pay):
 * setCartEmail -> setCartAddresses -> getShippingOptions -> setShippingMethod -> initializePaymentSession
 *
 * Returns the updated cart on success, or throws on error.
 */
export async function applyExpressCheckoutData(
  cartId: string,
  email: string,
  shipping: AddressPayload,
  billing?: AddressPayload,
): Promise<string> {
  const emailError = await setCartEmail(cartId, email);
  if (emailError) throw new Error(emailError);

  const addressError = await setCartAddresses(cartId, shipping, billing);
  if (addressError) throw new Error(addressError);

  const options = await getShippingOptions(cartId);
  if (options.length === 0) {
    throw new Error("No shipping options available");
  }

  const shippingError = await setShippingMethod(cartId, options[0]!.id);
  if (shippingError) throw new Error(shippingError);

  const paymentError = await initializePaymentSession(
    cartId,
    STRIPE_PROVIDER_ID,
  );
  if (paymentError) throw new Error(paymentError);

  // Fetch updated cart and find the Stripe session by provider_id
  const updatedCart = await getCheckoutCart();
  const stripeSession = updatedCart?.payment_collection?.payment_sessions?.find(
    (s) => s.provider_id === STRIPE_PROVIDER_ID,
  );
  const secret = stripeSession?.data?.client_secret as string | undefined;
  if (!secret) throw new Error("Payment session created but no client secret found");
  return secret;
}

// === Customer Addresses (for saved address picker) ===

export async function getCustomerAddresses(): Promise<
  HttpTypes.StoreCustomerAddress[]
> {
  const headers = await getAuthHeaders();
  if (!("authorization" in headers)) return [];

  try {
    const { addresses } = await sdk.client.fetch<{
      addresses: HttpTypes.StoreCustomerAddress[];
    }>("/store/customers/me/addresses", {
      method: "GET",
      headers,
    }).catch(medusaError);
    return addresses;
  } catch (error) {
    console.error("[checkout] Failed to fetch customer addresses:", error);
    return [];
  }
}
