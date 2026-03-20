"use client";

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { ShoppingBagIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { redirectToCheckout } from "components/cart/actions";
import { useCart } from "components/cart/cart-context";
import { trackClient } from "lib/analytics";
import { EditItemQuantityButton } from "components/cart/edit-item-quantity-button";
import CartPrice from "components/price/cart-price";
import { DEFAULT_OPTION } from "lib/constants";
import { createUrl } from "lib/utils";
import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createCartAndSetCookie } from "./actions";
import { DeleteItemButton } from "./delete-item-button";

function CartCount() {
  const { cart } = useCart();
  return <>{cart?.totalQuantity ?? 0}</>;
}

export function Cart() {
  const { cart, updateCartItem } = useCart();
  const [isOpen, setIsOpen] = useState(false);
  const quantityRef = useRef(cart?.totalQuantity);
  const openCart = () => {
    setIsOpen(true);
    trackClient("cart_drawer_opened", {});
  };
  const closeCart = () => setIsOpen(false);

  useEffect(() => {
    if (!cart) {
      createCartAndSetCookie().catch((e) => {
        console.error("[Cart] Failed to create cart:", e);
      });
    }
  }, [cart]);

  // Auto-open cart when quantity increases
  useEffect(() => {
    if (
      cart?.totalQuantity &&
      cart.totalQuantity !== quantityRef.current &&
      cart.totalQuantity > 0
    ) {
      openCart();
      quantityRef.current = cart.totalQuantity;
    }
  }, [isOpen, cart?.totalQuantity]);

  return (
    <>
      {/* Cart Button */}
      <button
        onClick={openCart}
        className="group focus-visible:outline-primary-600 -m-2 flex items-center rounded-md p-2 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <ShoppingBagIcon
          aria-hidden="true"
          className="size-6 shrink-0 text-gray-400 group-hover:text-gray-500"
        />
        <span className="ml-2 text-sm font-medium text-gray-700 group-hover:text-gray-800">
          <Suspense fallback="0">
            <CartCount />
          </Suspense>
        </span>
        <span className="sr-only">items in cart, view bag</span>
      </button>

      {/* Cart Dialog */}
      <Dialog open={isOpen} onClose={closeCart} className="relative z-10">
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-gray-500/75 transition-opacity duration-500 ease-in-out data-closed:opacity-0"
        />

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
              <DialogPanel
                transition
                className="pointer-events-auto w-screen max-w-md transform transition duration-500 ease-in-out data-closed:translate-x-full sm:duration-700"
              >
                <div className="flex h-full flex-col overflow-y-auto bg-white shadow-xl">
                  <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
                    <div className="flex items-start justify-between">
                      <DialogTitle className="text-lg font-medium text-gray-900">
                        Shopping cart
                      </DialogTitle>
                      <div className="ml-3 flex h-7 items-center">
                        <button
                          type="button"
                          onClick={closeCart}
                          className="focus-visible:outline-primary-600 relative -m-2 rounded-md p-2 text-gray-400 hover:text-gray-500 focus-visible:outline-2 focus-visible:outline-offset-2"
                        >
                          <span className="absolute -inset-0.5" />
                          <span className="sr-only">Close panel</span>
                          <XMarkIcon aria-hidden="true" className="size-6" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-8">
                      <div className="flow-root">
                        {!cart || cart.lines.length === 0 ? (
                          <div className="py-12 text-center">
                            <p className="text-gray-500">Your cart is empty</p>
                          </div>
                        ) : (
                          <ul
                            role="list"
                            className="-my-6 divide-y divide-gray-200"
                          >
                            {cart.lines
                              .sort((a, b) =>
                                a.merchandise.product.title.localeCompare(
                                  b.merchandise.product.title,
                                ),
                              )
                              .map((item) => {
                                const merchandiseSearchParams: Record<
                                  string,
                                  string
                                > = {};
                                item.merchandise.selectedOptions.forEach(
                                  ({ name, value }) => {
                                    if (value !== DEFAULT_OPTION) {
                                      merchandiseSearchParams[
                                        name.toLowerCase()
                                      ] = value;
                                    }
                                  },
                                );
                                const merchandiseUrl = createUrl(
                                  `/product/${item.merchandise.product.handle}`,
                                  new URLSearchParams(merchandiseSearchParams),
                                );

                                return (
                                  <li
                                    key={item.id || item.merchandise.id}
                                    className="flex py-6"
                                  >
                                    <div className="size-24 shrink-0 overflow-hidden rounded-md border border-gray-200">
                                      <Image
                                        alt={
                                          item.merchandise.product.featuredImage
                                            .altText ||
                                          item.merchandise.product.title
                                        }
                                        src={
                                          item.merchandise.product.featuredImage
                                            .url
                                        }
                                        width={96}
                                        height={96}
                                        className="size-full object-cover"
                                      />
                                    </div>

                                    <div className="ml-4 flex flex-1 flex-col">
                                      <div>
                                        <div className="flex justify-between text-sm font-medium text-gray-900">
                                          <h3>
                                            <Link href={merchandiseUrl}>
                                              {item.merchandise.product.title}
                                            </Link>
                                          </h3>
                                          <CartPrice
                                            className="ml-4"
                                            amount={
                                              item.cost.totalAmount.amount
                                            }
                                            currencyCode={
                                              item.cost.totalAmount.currencyCode
                                            }
                                          />
                                        </div>
                                      </div>
                                      <div className="flex flex-1 items-end justify-between text-sm">
                                        <div className="ml-0 flex h-7 flex-row items-center rounded-full border border-gray-200 bg-white">
                                          <EditItemQuantityButton
                                            item={item}
                                            type="minus"
                                            optimisticUpdate={updateCartItem}
                                            size="xs"
                                          />
                                          <span className="text-primary-500 relative z-10 mx-1 w-8 px-0.5 text-center text-sm leading-none font-semibold tabular-nums select-none">
                                            {item.quantity}
                                          </span>
                                          <EditItemQuantityButton
                                            item={item}
                                            type="plus"
                                            optimisticUpdate={updateCartItem}
                                            size="xs"
                                          />
                                        </div>

                                        <div className="flex">
                                          <DeleteItemButton
                                            item={item}
                                            optimisticUpdate={updateCartItem}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </li>
                                );
                              })}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 px-4 py-6 sm:px-6">
                    <div className="flex justify-between text-base font-medium text-gray-900">
                      <p>Subtotal</p>
                      <div className="text-right">
                        {cart && Number(cart.cost.subtotalAmount.amount) > 0 ? (
                          <CartPrice
                            amount={cart.cost.subtotalAmount.amount}
                            currencyCode={cart.cost.subtotalAmount.currencyCode}
                          />
                        ) : (
                          <span>$0.00</span>
                        )}
                      </div>
                    </div>
                    <p className="mt-0.5 text-sm text-gray-500">
                      Shipping and taxes calculated at checkout.
                    </p>
                    <div className="mt-6">
                      <form action={redirectToCheckout}>
                        <CheckoutButton />
                      </form>
                    </div>
                    <div className="mt-6 flex justify-center text-center text-sm text-gray-500">
                      <p>
                        or{" "}
                        <button
                          type="button"
                          onClick={closeCart}
                          className="text-primary-600 hover:text-primary-500 focus-visible:outline-primary-600 rounded font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
                        >
                          Continue Shopping
                          <span aria-hidden="true"> &rarr;</span>
                        </button>
                      </p>
                    </div>
                  </div>
                </div>
              </DialogPanel>
            </div>
          </div>
        </div>
      </Dialog>
    </>
  );
}

function CheckoutButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="bg-primary-600 hover:bg-primary-700 focus-visible:ring-primary-500 flex w-full items-center justify-center rounded-md px-6 py-3 text-base font-medium text-white shadow-xs focus:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
      type="submit"
      disabled={pending}
    >
      {pending ? "Processing..." : "Checkout"}
    </button>
  );
}
