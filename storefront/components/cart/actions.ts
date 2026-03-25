"use server";

import * as Sentry from "@sentry/nextjs";
import { TAGS } from "lib/constants";
import {
  addToCart,
  createCart,
  getCart,
  removeFromCart,
  updateCart,
} from "lib/medusa";
import { trackServer } from "lib/analytics-server";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";

export type CartActionState = string | null;

function revalidateCart(): void {
  revalidateTag(TAGS.cart, "max");
  revalidatePath("/", "layout");
}

export async function addItem(
  prevState: CartActionState,
  selectedVariantId: string | undefined,
): Promise<CartActionState> {
  if (!selectedVariantId) {
    return "Please select a product variant";
  }

  try {
    const cart = await addToCart([
      { merchandiseId: selectedVariantId, quantity: 1 },
    ]);
    const addedLine = cart.lines.find(
      (line) => line.merchandise.id === selectedVariantId,
    );
    try {
      await trackServer("product_added_to_cart", {
        product_id: addedLine?.merchandise.product.id ?? "",
        variant_id: selectedVariantId,
        quantity: 1,
        price:
          Number(addedLine?.cost.totalAmount.amount ?? 0) /
          (addedLine?.quantity ?? 1),
      });
    } catch {}
    return null;
  } catch (e) {
    Sentry.captureException(e, { tags: { action: "add_to_cart" } });
    return e instanceof Error ? e.message : "Error adding item to cart";
  } finally {
    revalidateCart();
  }
}

export async function removeItem(
  prevState: CartActionState,
  lineItemId: string,
): Promise<CartActionState> {
  if (!lineItemId) {
    return "Missing item ID — please try again";
  }

  try {
    await removeFromCart([lineItemId]);
    try {
      await trackServer("cart_item_removed", {
        product_id: "",
        variant_id: "",
      });
    } catch {}
    return null;
  } catch (e) {
    Sentry.captureException(e, { tags: { action: "remove_from_cart" } });
    return e instanceof Error ? e.message : "Error removing item from cart";
  } finally {
    revalidateCart();
  }
}

export async function updateItemQuantity(
  prevState: CartActionState,
  payload: {
    merchandiseId: string;
    quantity: number;
  },
): Promise<CartActionState> {
  const { merchandiseId, quantity } = payload;

  if (!merchandiseId) {
    return "Missing product variant ID";
  }
  if (quantity < 0) {
    return "Quantity cannot be negative";
  }

  try {
    const cart = await getCart();

    if (!cart) {
      return "Error fetching cart";
    }

    const lineItem = cart.lines.find(
      (line) => line.merchandise.id === merchandiseId,
    );

    if (lineItem && lineItem.id) {
      if (quantity === 0) {
        await removeFromCart([lineItem.id]);
      } else {
        await updateCart([{ id: lineItem.id, merchandiseId, quantity }]);
      }
    } else if (quantity > 0) {
      await addToCart([{ merchandiseId, quantity }]);
    }

    try {
      await trackServer("cart_item_updated", {
        product_id: "",
        variant_id: merchandiseId,
        new_quantity: quantity,
      });
    } catch {}

    return null;
  } catch (e) {
    Sentry.captureException(e, { tags: { action: "update_cart_quantity" } });
    return e instanceof Error ? e.message : "Error updating item quantity";
  } finally {
    revalidateCart();
  }
}

export async function redirectToCheckout() {
  redirect("/checkout");
}

export async function createCartAndSetCookie() {
  try {
    await createCart();
  } catch (e) {
    Sentry.captureException(e, { tags: { action: "create_cart" } });
    throw e;
  }
}
