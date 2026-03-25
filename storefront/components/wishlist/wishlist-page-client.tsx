"use client";

import {
  HeartIcon,
  ShareIcon,
  PlusIcon,
  XMarkIcon,
  ShoppingBagIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
} from "@headlessui/react";
import { useActionState, useState, useTransition } from "react";
import { addItem } from "components/cart/actions";
import {
  createWishlist,
  deleteWishlist,
  removeFromWishlist,
  renameWishlist,
  shareWishlist,
  type WishlistActionResult,
} from "lib/medusa/wishlist";
import { useNotification } from "components/notifications";
import type { Wishlist, WishlistItem } from "lib/types";
import Image from "next/image";
import Link from "next/link";
import clsx from "clsx";

export function WishlistPageClient({ wishlists }: { wishlists: Wishlist[] }) {
  const [activeTab, setActiveTab] = useState(0);

  if (!wishlists.length) {
    return <EmptyState />;
  }

  const activeWishlist = wishlists[activeTab] ?? wishlists[0];

  return (
    <div>
      {/* Tab navigation when multiple wishlists */}
      {wishlists.length > 1 && (
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Wishlists">
            {wishlists.map((wl, index) => (
              <button
                key={wl.id}
                type="button"
                onClick={() => setActiveTab(index)}
                className={clsx(
                  "border-b-2 px-1 py-4 text-sm font-medium whitespace-nowrap",
                  index === activeTab
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700",
                )}
              >
                {wl.name || "Wishlist"}
                <span
                  className={clsx(
                    "ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                    index === activeTab
                      ? "bg-primary-100 text-primary-600"
                      : "bg-gray-100 text-gray-600",
                  )}
                >
                  {wl.items?.length ?? 0}
                </span>
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Wishlist header with actions */}
      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-900">
          {activeWishlist?.name || "My Wishlist"}
        </h2>
        <div className="flex items-center gap-3">
          <WishlistActionsMenu
            wishlist={activeWishlist!}
            onDeleted={() => setActiveTab(0)}
          />
          <ShareButton wishlistId={activeWishlist!.id} />
          <NewWishlistButton />
        </div>
      </div>

      {/* Items grid */}
      {activeWishlist && activeWishlist.items?.length > 0 ? (
        <div className="mt-8 grid grid-cols-1 gap-y-12 sm:grid-cols-2 sm:gap-x-6 lg:grid-cols-3 xl:gap-x-8">
          {activeWishlist.items.map((item) => (
            <WishlistItemCard
              key={item.id}
              item={item}
              wishlistId={activeWishlist.id}
            />
          ))}
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// WishlistItemCard
// ---------------------------------------------------------------------------

function WishlistItemCard({
  item,
  wishlistId,
}: {
  item: WishlistItem;
  wishlistId: string;
}) {
  const { showNotification } = useNotification();
  const [isRemoving, startRemoveTransition] = useTransition();
  const [addToCartMessage, addToCartAction] = useActionState(addItem, null);
  const [isAddingToCart, startAddTransition] = useTransition();

  const variant = item.product_variant;
  const product = variant?.product;
  const thumbnail = product?.thumbnail;

  const boundAddToCart = addToCartAction.bind(null, item.product_variant_id);

  function handleRemove() {
    startRemoveTransition(async () => {
      const formData = new FormData();
      formData.set("wishlist_id", wishlistId);
      formData.set("item_id", item.id);
      if (product?.id) formData.set("product_id", product.id);
      if (item.product_variant_id)
        formData.set("variant_id", item.product_variant_id);
      const result = await removeFromWishlist(null, formData);
      if (result?.error) {
        showNotification("error", "Could not remove item", result.error);
      } else {
        showNotification("success", "Removed from wishlist");
      }
    });
  }

  return (
    <div
      className={clsx(
        "group relative flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white",
        isRemoving && "pointer-events-none opacity-50",
      )}
    >
      {/* Remove button */}
      <button
        type="button"
        onClick={handleRemove}
        disabled={isRemoving}
        className="absolute top-2 right-2 z-10 rounded-full bg-white/80 p-1.5 text-gray-400 shadow-sm backdrop-blur-sm transition-colors hover:bg-white hover:text-gray-600"
        aria-label="Remove from wishlist"
      >
        <XMarkIcon className="size-5" />
      </button>

      {/* Product image */}
      {thumbnail ? (
        <Link
          href={product?.handle ? `/product/${product.handle}` : "#"}
          prefetch={true}
        >
          <Image
            src={thumbnail}
            alt={product?.title || "Product image"}
            width={400}
            height={400}
            className="aspect-[3/4] w-full bg-gray-200 object-cover group-hover:opacity-75 sm:aspect-auto sm:h-72"
          />
        </Link>
      ) : (
        <div className="flex aspect-[3/4] w-full items-center justify-center bg-gray-100 sm:aspect-auto sm:h-72">
          <ShoppingBagIcon className="size-12 text-gray-300" />
        </div>
      )}

      {/* Product info + actions */}
      <div className="flex flex-1 flex-col space-y-2 p-4">
        {product ? (
          <h3 className="text-sm font-medium text-gray-900">
            <Link href={`/product/${product.handle}`}>
              <span aria-hidden="true" className="absolute inset-0" />
              {product.title}
            </Link>
          </h3>
        ) : (
          <h3 className="text-sm font-medium text-gray-900">Unknown product</h3>
        )}

        {variant?.title && variant.title !== "Default" && (
          <p className="text-sm text-gray-500">{variant.title}</p>
        )}

        {/* Add to cart — pushed to bottom */}
        <div className="flex flex-1 flex-col justify-end pt-2">
          <form
            action={() => {
              startAddTransition(() => {
                boundAddToCart();
              });
            }}
          >
            <button
              type="submit"
              disabled={isAddingToCart}
              className={clsx(
                "relative flex w-full items-center justify-center rounded-md border border-transparent bg-gray-100 px-8 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200",
                isAddingToCart && "cursor-not-allowed opacity-50",
              )}
            >
              {isAddingToCart ? "Adding..." : "Add to Cart"}
            </button>
          </form>

          {addToCartMessage && typeof addToCartMessage === "string" && (
            <p className="mt-1 text-sm text-red-600">{addToCartMessage}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="py-16 text-center">
      <HeartIcon className="mx-auto size-12 text-gray-400" />
      <h3 className="mt-4 text-sm font-semibold text-gray-900">
        No saved items yet
      </h3>
      <p className="mt-2 text-sm text-gray-500">
        Start browsing and save the products you love.
      </p>
      <div className="mt-6">
        <Link
          href="/products"
          className="bg-primary-600 hover:bg-primary-500 focus-visible:outline-primary-600 inline-flex items-center rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Browse Products
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ShareButton
// ---------------------------------------------------------------------------

function ShareButton({ wishlistId }: { wishlistId: string }) {
  const { showNotification } = useNotification();
  const [isPending, startTransition] = useTransition();

  function handleShare() {
    startTransition(async () => {
      const token = await shareWishlist(wishlistId);
      if (!token) {
        showNotification("error", "Could not generate share link");
        return;
      }

      const url = `${window.location.origin}/wishlist/shared/${token}`;

      try {
        await navigator.clipboard.writeText(url);
        showNotification("success", "Share link copied to clipboard");
      } catch {
        // Fallback: show the URL in the notification if clipboard fails
        showNotification("success", "Share link generated", url);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={isPending}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset hover:bg-gray-50",
        isPending && "cursor-not-allowed opacity-50",
      )}
    >
      <ShareIcon className="-ml-0.5 size-4" />
      {isPending ? "Sharing..." : "Share"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// NewWishlistButton
// ---------------------------------------------------------------------------

function NewWishlistButton() {
  const [open, setOpen] = useState(false);
  const { showNotification } = useNotification();

  const [state, formAction, isPending] = useActionState<
    WishlistActionResult,
    FormData
  >(async (prev, formData) => {
    const result = await createWishlist(prev, formData);
    if (result?.success) {
      setOpen(false);
      showNotification("success", "Wishlist created");
    } else if (result?.error) {
      showNotification("error", "Could not create wishlist", result.error);
    }
    return result;
  }, null);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-primary-600 hover:bg-primary-500 focus-visible:outline-primary-600 inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <PlusIcon className="-ml-0.5 size-4" />
        New Wishlist
      </button>

      <Dialog open={open} onClose={setOpen} className="relative z-50">
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-gray-500/75 transition-opacity data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in"
        />

        <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <DialogPanel
              transition
              className="relative w-full transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in sm:my-8 sm:max-w-sm sm:p-6 data-closed:sm:translate-y-0 data-closed:sm:scale-95"
            >
              <div>
                <DialogTitle
                  as="h3"
                  className="text-base font-semibold text-gray-900"
                >
                  Create New Wishlist
                </DialogTitle>

                <form action={formAction} className="mt-4">
                  <label
                    htmlFor="wishlist-name"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Name
                  </label>
                  <input
                    id="wishlist-name"
                    name="name"
                    type="text"
                    required
                    placeholder="e.g. Gift ideas"
                    className="focus:outline-primary-600 mt-1 block w-full rounded-md bg-white px-3 py-2 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 sm:text-sm/6"
                  />

                  {state?.error && (
                    <p className="mt-2 text-sm text-red-600">{state.error}</p>
                  )}

                  <div className="mt-5 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isPending}
                      className={clsx(
                        "bg-primary-600 hover:bg-primary-500 focus-visible:outline-primary-600 rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2",
                        isPending && "cursor-not-allowed opacity-50",
                      )}
                    >
                      {isPending ? "Creating..." : "Create"}
                    </button>
                  </div>
                </form>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// WishlistActionsMenu
// ---------------------------------------------------------------------------

function WishlistActionsMenu({
  wishlist,
  onDeleted,
}: {
  wishlist: Wishlist;
  onDeleted: () => void;
}) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <Menu as="div" className="relative">
        <MenuButton className="inline-flex items-center rounded-md bg-white p-2 text-gray-400 shadow-sm ring-1 ring-gray-300 ring-inset hover:bg-gray-50 hover:text-gray-500">
          <span className="sr-only">Wishlist options</span>
          <EllipsisVerticalIcon className="size-5" />
        </MenuButton>

        <MenuItems
          transition
          className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5 transition focus:outline-none data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-100 data-enter:ease-out data-leave:duration-75 data-leave:ease-in"
        >
          <MenuItem>
            <button
              type="button"
              onClick={() => setRenameOpen(true)}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 data-focus:bg-gray-100 data-focus:text-gray-900"
            >
              <PencilIcon className="size-4" />
              Rename
            </button>
          </MenuItem>
          <MenuItem>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 data-focus:bg-red-50 data-focus:text-red-700"
            >
              <TrashIcon className="size-4" />
              Delete
            </button>
          </MenuItem>
        </MenuItems>
      </Menu>

      <RenameWishlistDialog
        key={wishlist.id + (wishlist.name ?? "")}
        wishlist={wishlist}
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
      />
      <DeleteWishlistDialog
        wishlist={wishlist}
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onDeleted={onDeleted}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// RenameWishlistDialog
// ---------------------------------------------------------------------------

function RenameWishlistDialog({
  wishlist,
  open,
  onClose,
}: {
  wishlist: Wishlist;
  open: boolean;
  onClose: () => void;
}) {
  const { showNotification } = useNotification();
  const [state, formAction, isPending] = useActionState<
    WishlistActionResult,
    FormData
  >(async (prev, formData) => {
    formData.set("wishlist_id", wishlist.id);
    const result = await renameWishlist(prev, formData);
    if (result?.success) {
      onClose();
      showNotification("success", "Wishlist renamed");
    } else if (result?.error) {
      showNotification("error", "Could not rename wishlist", result.error);
    }
    return result;
  }, null);

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-gray-500/75 transition-opacity data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in"
      />
      <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <DialogPanel
            transition
            className="relative w-full transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in sm:my-8 sm:max-w-sm sm:p-6 data-closed:sm:translate-y-0 data-closed:sm:scale-95"
          >
            <DialogTitle
              as="h3"
              className="text-base font-semibold text-gray-900"
            >
              Rename Wishlist
            </DialogTitle>
            <form action={formAction} className="mt-4">
              <label
                htmlFor="rename-wishlist"
                className="block text-sm font-medium text-gray-700"
              >
                Name
              </label>
              <input
                id="rename-wishlist"
                name="name"
                type="text"
                required
                defaultValue={wishlist.name || ""}
                className="focus:outline-primary-600 mt-1 block w-full rounded-md bg-white px-3 py-2 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 sm:text-sm/6"
              />
              {state?.error && (
                <p className="mt-2 text-sm text-red-600">{state.error}</p>
              )}
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className={clsx(
                    "bg-primary-600 hover:bg-primary-500 focus-visible:outline-primary-600 rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2",
                    isPending && "cursor-not-allowed opacity-50",
                  )}
                >
                  {isPending ? "Renaming..." : "Rename"}
                </button>
              </div>
            </form>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// DeleteWishlistDialog
// ---------------------------------------------------------------------------

function DeleteWishlistDialog({
  wishlist,
  open,
  onClose,
  onDeleted,
}: {
  wishlist: Wishlist;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { showNotification } = useNotification();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("wishlist_id", wishlist.id);
      const result = await deleteWishlist(null, formData);
      if (result?.error) {
        showNotification("error", "Could not delete wishlist", result.error);
      } else {
        showNotification("success", "Wishlist deleted");
        onClose();
        onDeleted();
      }
    });
  }

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-gray-500/75 transition-opacity data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in"
      />
      <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <DialogPanel
            transition
            className="relative w-full transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in sm:my-8 sm:max-w-sm sm:p-6 data-closed:sm:translate-y-0 data-closed:sm:scale-95"
          >
            <DialogTitle
              as="h3"
              className="text-base font-semibold text-gray-900"
            >
              Delete Wishlist
            </DialogTitle>
            <p className="mt-2 text-sm text-gray-500">
              Are you sure you want to delete &ldquo;
              {wishlist.name || "this wishlist"}&rdquo;? This action cannot be
              undone.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className={clsx(
                  "rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600",
                  isPending && "cursor-not-allowed opacity-50",
                )}
              >
                {isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
