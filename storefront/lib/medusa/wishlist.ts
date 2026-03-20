"use server";

import { sdk } from "lib/medusa";
import { TAGS } from "lib/constants";
import type { Wishlist } from "lib/types";
import { revalidatePath, revalidateTag } from "next/cache";
import {
  getAuthHeaders,
  getAuthToken,
  getWishlistId,
  setWishlistId,
  removeWishlistId,
} from "lib/medusa/cookies";
import { trackServer } from "lib/analytics-server";

export type WishlistActionResult = { error?: string; success?: boolean } | null;

type WishlistResponse = { wishlist: Wishlist };
type WishlistsResponse = { wishlists: Wishlist[] };

function revalidateWishlists(): void {
  revalidateTag(TAGS.wishlists, "max");
  revalidatePath("/", "layout");
}

function formatError(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

/**
 * Runs a mutation callback, catches errors into WishlistActionResult,
 * and always revalidates wishlists afterwards.
 */
async function wishlistMutation(
  fn: () => Promise<void>,
  fallbackError: string,
): Promise<WishlistActionResult> {
  try {
    await fn();
  } catch (e) {
    return { error: formatError(e, fallbackError) };
  } finally {
    revalidateWishlists();
  }
  return { success: true };
}

// ---------------------------------------------------------------------------
// Read Operations
// ---------------------------------------------------------------------------

/**
 * Core wishlist fetching logic shared by both getWishlists and
 * getWishlistsDynamic. Handles both authenticated and guest flows.
 */
async function fetchWishlists(): Promise<Wishlist[]> {
  const token = await getAuthToken();
  const headers = await getAuthHeaders();

  if (token) {
    try {
      const result = await sdk.client.fetch<WishlistsResponse>(
        "/store/customers/me/wishlists",
        { method: "GET", headers },
      );
      return result.wishlists;
    } catch {
      return [];
    }
  }

  const wishlistId = await getWishlistId();
  if (!wishlistId) return [];

  try {
    const result = await sdk.client.fetch<WishlistResponse>(
      `/store/wishlists/${wishlistId}`,
      { method: "GET" },
    );
    return [result.wishlist];
  } catch {
    return [];
  }
}

export async function getWishlists(): Promise<Wishlist[]> {
  return fetchWishlists();
}

/**
 * Non-cached version of getWishlists for use in dynamic pages
 * (e.g. the account layout which already calls cookies()).
 * The cached getWishlists cannot be called from pages that are
 * statically prerendered because it uses cookies() inside "use cache".
 */
export async function getWishlistsDynamic(): Promise<Wishlist[]> {
  return fetchWishlists();
}

export async function getWishlist(wishlistId: string): Promise<Wishlist | null> {
  const headers = await getAuthHeaders();

  try {
    const result = await sdk.client.fetch<WishlistResponse>(
      `/store/wishlists/${wishlistId}`,
      { method: "GET", headers },
    );
    return result.wishlist;
  } catch {
    return null;
  }
}

export async function getSharedWishlist(token: string): Promise<Wishlist | null> {
  try {
    const result = await sdk.client.fetch<WishlistResponse>(
      `/store/wishlists/shared/${token}`,
      { method: "GET" },
    );
    return result.wishlist;
  } catch {
    return null;
  }
}

export async function getWishlistItemCount(): Promise<number> {
  const wishlists = await getWishlists();
  return wishlists.reduce((sum, wl) => sum + (wl.items?.length ?? 0), 0);
}

export async function getProductWishlistCount(
  productId: string,
): Promise<number> {
  try {
    const result = await sdk.client.fetch<{ count: number }>(
      `/store/products/${productId}/wishlist-count`,
      { method: "GET" },
    );
    return result.count;
  } catch {
    return 0;
  }
}

export type VariantWishlistState = {
  isInWishlist: boolean;
  wishlistId?: string;
  wishlistItemId?: string;
};

export async function getVariantWishlistState(
  variantId: string,
): Promise<VariantWishlistState> {
  const wishlists = await getWishlists();
  for (const wl of wishlists) {
    const item = wl.items?.find(
      (item) => item.product_variant_id === variantId,
    );
    if (item) {
      return {
        isInWishlist: true,
        wishlistId: wl.id,
        wishlistItemId: item.id,
      };
    }
  }
  return { isInWishlist: false };
}

export async function getVariantsWishlistStates(
  variantIds: string[],
): Promise<Map<string, VariantWishlistState>> {
  const wishlists = await getWishlists();
  const states = new Map<string, VariantWishlistState>();

  for (const id of variantIds) {
    states.set(id, { isInWishlist: false });
  }

  const variantIdSet = new Set(variantIds);

  for (const wl of wishlists) {
    for (const item of wl.items ?? []) {
      if (variantIdSet.has(item.product_variant_id)) {
        states.set(item.product_variant_id, {
          isInWishlist: true,
          wishlistId: wl.id,
          wishlistItemId: item.id,
        });
      }
    }
  }

  return states;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createWishlist(
  prevState: WishlistActionResult,
  formData: FormData,
): Promise<WishlistActionResult> {
  const name = formData.get("name") as string | null;
  const headers = await getAuthHeaders();

  let createdWishlist: Wishlist | undefined;
  const result = await wishlistMutation(
    () =>
      sdk.client.fetch<WishlistResponse>(
        "/store/customers/me/wishlists",
        { method: "POST", headers, body: { name: name || undefined } },
      ).then((res) => { createdWishlist = res.wishlist; }),
    "Error creating wishlist",
  );
  if (result?.success && createdWishlist) {
    try { await trackServer("wishlist_created", { wishlist_id: createdWishlist.id, has_name: Boolean(createdWishlist.name || name), name_length: (createdWishlist.name || name || "").length }) } catch {}
  }
  return result;
}

export async function addToWishlist(
  prevState: WishlistActionResult,
  formData: FormData,
): Promise<WishlistActionResult> {
  const variantId = formData.get("variant_id") as string;
  const productId = formData.get("product_id") as string | null;
  let wishlistId = formData.get("wishlist_id") as string | null;

  if (!variantId) return { error: "Variant ID is required" };

  const token = await getAuthToken();
  const headers = await getAuthHeaders();

  if (token) {
    // Authenticated flow: resolve target wishlist if not specified
    if (!wishlistId) {
      const wishlists = await getWishlists();
      if (wishlists.length === 1) {
        wishlistId = wishlists[0]!.id;
      } else if (wishlists.length === 0) {
        try {
          const result = await sdk.client.fetch<WishlistResponse>(
            "/store/customers/me/wishlists",
            { method: "POST", headers, body: { name: "My Wishlist" } },
          );
          wishlistId = result.wishlist.id;
        } catch (e) {
          return { error: formatError(e, "Error creating wishlist") };
        }
      } else {
        return { error: "Please select a wishlist" };
      }
    }

    const authResult = await wishlistMutation(
      () =>
        sdk.client.fetch<WishlistResponse>(
          `/store/customers/me/wishlists/${wishlistId}/items`,
          { method: "POST", headers, body: { variant_id: variantId } },
        ).then(() => undefined),
      "Error adding to wishlist",
    );
    if (authResult?.success && productId) {
      try { await trackServer("wishlist_item_added", { product_id: productId, variant_id: variantId, wishlist_id: wishlistId }) } catch {}
    }
    return authResult;
  }

  // Guest flow: lazy-create guest wishlist
  let guestWishlistId = await getWishlistId();

  if (!guestWishlistId) {
    try {
      const result = await sdk.client.fetch<WishlistResponse>(
        "/store/wishlists",
        { method: "POST" },
      );
      guestWishlistId = result.wishlist.id;
      await setWishlistId(guestWishlistId);
    } catch (e) {
      return { error: formatError(e, "Error creating wishlist") };
    }
  }

  const guestResult = await wishlistMutation(
    () =>
      sdk.client.fetch<WishlistResponse>(
        `/store/wishlists/${guestWishlistId}/items`,
        { method: "POST", body: { variant_id: variantId } },
      ).then(() => undefined),
    "Error adding to wishlist",
  );
  if (guestResult?.success && productId) {
    try { await trackServer("wishlist_item_added", { product_id: productId, variant_id: variantId, wishlist_id: guestWishlistId }) } catch {}
  }
  return guestResult;
}

export async function removeFromWishlist(
  prevState: WishlistActionResult,
  formData: FormData,
): Promise<WishlistActionResult> {
  const wishlistId = formData.get("wishlist_id") as string;
  const itemId = formData.get("item_id") as string;
  const productId = formData.get("product_id") as string | null;
  const variantId = formData.get("variant_id") as string | null;

  if (!wishlistId || !itemId) return { error: "Missing wishlist or item ID" };

  const token = await getAuthToken();
  const headers = await getAuthHeaders();

  const basePath = token
    ? `/store/customers/me/wishlists/${wishlistId}/items/${itemId}`
    : `/store/wishlists/${wishlistId}/items/${itemId}`;

  const removeResult = await wishlistMutation(
    () => sdk.client.fetch(basePath, { method: "DELETE", headers }).then(() => undefined),
    "Error removing item",
  );
  if (removeResult?.success) {
    if (productId && variantId) {
      try { await trackServer("wishlist_item_removed", { product_id: productId, variant_id: variantId, wishlist_id: wishlistId }) } catch {}
    }
  }
  return removeResult;
}

export async function deleteWishlist(
  prevState: WishlistActionResult,
  formData: FormData,
): Promise<WishlistActionResult> {
  const wishlistId = formData.get("wishlist_id") as string;
  if (!wishlistId) return { error: "Wishlist ID is required" };

  const headers = await getAuthHeaders();

  const deleteResult = await wishlistMutation(
    () =>
      sdk.client.fetch(
        `/store/customers/me/wishlists/${wishlistId}`,
        { method: "DELETE", headers },
      ).then(() => undefined),
    "Error deleting wishlist",
  );
  if (deleteResult?.success) {
    try { await trackServer("wishlist_deleted", { wishlist_id: wishlistId }) } catch {}
  }
  return deleteResult;
}

export async function renameWishlist(
  prevState: WishlistActionResult,
  formData: FormData,
): Promise<WishlistActionResult> {
  const wishlistId = formData.get("wishlist_id") as string;
  const name = formData.get("name") as string;

  if (!wishlistId) return { error: "Wishlist ID is required" };

  const headers = await getAuthHeaders();

  const renameResult = await wishlistMutation(
    () =>
      sdk.client.fetch(
        `/store/customers/me/wishlists/${wishlistId}`,
        { method: "PUT", headers, body: { name } },
      ).then(() => undefined),
    "Error renaming wishlist",
  );
  if (renameResult?.success) {
    try { await trackServer("wishlist_renamed", { wishlist_id: wishlistId }) } catch {}
  }
  return renameResult;
}

export async function transferWishlist(): Promise<void> {
  const guestWishlistId = await getWishlistId();
  if (!guestWishlistId) return;

  const headers = await getAuthHeaders();

  try {
    await sdk.client.fetch(
      `/store/customers/me/wishlists/${guestWishlistId}/transfer`,
      { method: "POST", headers },
    );
    await removeWishlistId();
  } catch {
    // Transfer is best-effort -- keep cookie so guest data isn't lost
  } finally {
    revalidateWishlists();
  }
}

export async function shareWishlist(wishlistId: string): Promise<string | null> {
  const headers = await getAuthHeaders();

  try {
    const result = await sdk.client.fetch<{ token: string }>(
      `/store/customers/me/wishlists/${wishlistId}/share`,
      { method: "POST", headers },
    );
    const wishlist = await getWishlist(wishlistId);
    try { await trackServer("wishlist_shared", { wishlist_id: wishlistId, item_count: wishlist?.items?.length ?? 0 }) } catch {}
    return result.token;
  } catch {
    return null;
  }
}

export async function importWishlist(
  shareToken: string,
): Promise<WishlistActionResult> {
  const headers = await getAuthHeaders();

  let importedWishlist: Wishlist | undefined;
  const importResult = await wishlistMutation(
    () =>
      sdk.client.fetch<WishlistResponse>(
        "/store/wishlists/import",
        { method: "POST", headers, body: { share_token: shareToken } },
      ).then((res) => { importedWishlist = res.wishlist; }),
    "Error importing wishlist",
  );
  if (importResult?.success && importedWishlist) {
    try { await trackServer("wishlist_imported", { wishlist_id: importedWishlist.id, item_count: importedWishlist.items?.length ?? 0 }) } catch {}
  }
  return importResult;
}
