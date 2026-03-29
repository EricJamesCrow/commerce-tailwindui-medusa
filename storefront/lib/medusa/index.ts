import * as Sentry from "@sentry/nextjs";
import Medusa from "@medusajs/js-sdk";
import type { HttpTypes } from "@medusajs/types";
import { HIDDEN_PRODUCT_TAG, TAGS } from "lib/constants";
import { FOOTER_CONFIG } from "lib/constants/footer";
import { DEFAULT_NAVIGATION } from "lib/constants/navigation";
import type { Cart, Collection, Navigation, Page, Product } from "lib/types";
import { sanitizeEnvUrl, sanitizeEnvValue } from "lib/env";
import { cacheLife, cacheTag, revalidateTag, unstable_cache } from "next/cache";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getAuthHeaders, getCartId, removeCartId, setCartId } from "./cookies";
import { medusaError } from "./error";
import {
  transformCart,
  transformCollection,
  transformProduct,
} from "./transforms";

const STATIC_PAGE_LINKS = [
  ...FOOTER_CONFIG.company,
  ...FOOTER_CONFIG.legal,
  { name: "Support", href: "/support" },
] as const;
const STATIC_PAGE_TIMESTAMP = "2026-03-23T00:00:00.000Z";

function createStaticPage(handle: string, title: string): Page {
  return {
    id: `page_${handle}`,
    title,
    handle,
    body: `<p>${title} content coming soon.</p>`,
    bodySummary: `${title} content coming soon.`,
    createdAt: STATIC_PAGE_TIMESTAMP,
    updatedAt: STATIC_PAGE_TIMESTAMP,
  };
}

const STATIC_PAGES = new Map(
  STATIC_PAGE_LINKS.map(({ href, name }) => [
    href.replace(/^\//, ""),
    createStaticPage(href.replace(/^\//, ""), name),
  ]),
);

type ProductFetchQuery = {
  region_id: string;
  fields: string;
  limit: number;
  q?: string;
  order?: string;
  collection_id?: string[];
};

const CATALOG_REVALIDATE_SECONDS = 60 * 60 * 24;

// --- SDK Client ---

const MEDUSA_BACKEND_URL = sanitizeEnvUrl(
  process.env.MEDUSA_BACKEND_URL,
  "http://localhost:9000",
);

export const sdk = new Medusa({
  baseUrl: MEDUSA_BACKEND_URL,
  debug: false,
  publishableKey: sanitizeEnvValue(
    process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
  ),
});

// --- Region Helper (single-region mode) ---

let cachedRegion: HttpTypes.StoreRegion | null = null;

async function getDefaultRegion(): Promise<HttpTypes.StoreRegion> {
  if (cachedRegion) return cachedRegion;

  const { regions } = await sdk.client.fetch<{
    regions: HttpTypes.StoreRegion[];
  }>("/store/regions", {
    method: "GET",
    cache: "force-cache",
  });

  if (!regions.length) {
    throw new Error("No regions found in Medusa. Create at least one region.");
  }

  // Prefer region specified by env var, then USD region, then first region
  const preferredId = process.env.NEXT_PUBLIC_DEFAULT_REGION_ID;
  const preferred = preferredId
    ? regions.find((r) => r.id === preferredId)
    : undefined;

  cachedRegion =
    preferred ?? regions.find((r) => r.currency_code === "usd") ?? regions[0]!;
  return cachedRegion;
}

// --- Product Fields ---

const PRODUCT_FIELDS =
  "*variants.calculated_price,+variants.inventory_quantity,*variants.images,+metadata,+tags";

const CART_FIELDS =
  "*items,*items.product,*items.variant,*items.thumbnail,+items.total,*promotions,+shipping_methods.name";

// --- Shared Helpers ---

function buildSortOrder(
  sortKey?: string,
  reverse?: boolean,
): string | undefined {
  if (sortKey === "PRICE") {
    return reverse
      ? "-variants.calculated_price.calculated_amount"
      : "variants.calculated_price.calculated_amount";
  }
  if (sortKey === "CREATED_AT" || sortKey === "CREATED") {
    return reverse ? "-created_at" : "created_at";
  }
  if (sortKey === "BEST_SELLING") {
    return "-created_at";
  }
  return undefined;
}

function isHiddenProduct(product: HttpTypes.StoreProduct): boolean {
  const tags = (product.tags || []).map((t) => t.value ?? String(t));
  return tags.includes(HIDDEN_PRODUCT_TAG);
}

// --- Products ---

// These parameterized catalog loaders intentionally use unstable_cache instead
// of "use cache" because Next 16 prerendering hit USE_CACHE_TIMEOUT on the
// product route during Vercel builds. unstable_cache keeps explicit keys, tags,
// and TTLs without tripping that cache-components timeout path.
const getProductCached = unstable_cache(
  async (handle: string): Promise<Product | undefined> => {
    try {
      const region = await getDefaultRegion();

      const { products } = await sdk.client.fetch<{
        products: HttpTypes.StoreProduct[];
      }>("/store/products", {
        method: "GET",
        query: {
          handle,
          region_id: region.id,
          fields: PRODUCT_FIELDS,
          limit: 1,
        },
        cache: "force-cache",
        next: { tags: [TAGS.products] },
      });

      const product = products[0];
      if (!product) return undefined;

      return transformProduct(product);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { action: "get_product", handle },
        level: "warning",
      });
      return undefined;
    }
  },
  ["medusa-product"],
  {
    tags: [TAGS.products],
    revalidate: CATALOG_REVALIDATE_SECONDS,
  },
);

export async function getProduct(handle: string): Promise<Product | undefined> {
  return getProductCached(handle);
}

const getProductsCached = unstable_cache(
  async ({
    query,
    reverse,
    sortKey,
    limit = 100,
  }: {
    query?: string;
    reverse?: boolean;
    sortKey?: string;
    limit?: number;
  }): Promise<Product[]> => {
    try {
      const region = await getDefaultRegion();
      const order = buildSortOrder(sortKey, reverse);

      const fetchQuery: ProductFetchQuery = {
        region_id: region.id,
        fields: PRODUCT_FIELDS,
        limit,
      };

      if (query) fetchQuery.q = query;
      if (order) fetchQuery.order = order;

      const { products } = await sdk.client.fetch<{
        products: HttpTypes.StoreProduct[];
      }>("/store/products", {
        method: "GET",
        query: fetchQuery,
        cache: "force-cache",
        next: { tags: [TAGS.products] },
      });

      return products.filter((p) => !isHiddenProduct(p)).map(transformProduct);
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          action: "get_products",
          sort_key: sortKey ?? "default",
          has_query: query ? "true" : "false",
        },
        level: "warning",
      });
      return [];
    }
  },
  ["medusa-products"],
  {
    tags: [TAGS.products],
    revalidate: CATALOG_REVALIDATE_SECONDS,
  },
);

export async function getProducts({
  query,
  reverse,
  sortKey,
  limit = 100,
}: {
  query?: string;
  reverse?: boolean;
  sortKey?: string;
  limit?: number;
}): Promise<Product[]> {
  return getProductsCached({ query, reverse, sortKey, limit });
}

const getProductRecommendationsCached = unstable_cache(
  async (productId: string): Promise<Product[]> => {
    const region = await getDefaultRegion();

    const { products } = await sdk.client.fetch<{
      products: HttpTypes.StoreProduct[];
    }>("/store/products", {
      method: "GET",
      query: {
        region_id: region.id,
        fields: PRODUCT_FIELDS,
        limit: 5,
        order: "-created_at",
      },
      cache: "force-cache",
      next: { tags: [TAGS.products] },
    });

    return products
      .filter((p) => p.id !== productId && !isHiddenProduct(p))
      .slice(0, 4)
      .map(transformProduct);
  },
  ["medusa-product-recommendations"],
  {
    tags: [TAGS.products],
    revalidate: CATALOG_REVALIDATE_SECONDS,
  },
);

// Placeholder: Medusa v2 has no recommendation engine. This returns the 4 most
// recent products (excluding the current one) as a "you might also like" section.
export async function getProductRecommendations(
  productId: string,
): Promise<Product[]> {
  return getProductRecommendationsCached(productId);
}

// --- Collections ---

const getCollectionCached = unstable_cache(
  async (handle: string): Promise<Collection | undefined> => {
    try {
      const { collections } = await sdk.client.fetch<{
        collections: HttpTypes.StoreCollection[];
      }>("/store/collections", {
        method: "GET",
        query: { handle, limit: 1 },
        cache: "force-cache",
        next: { tags: [TAGS.collections] },
      });

      const collection = collections[0];
      if (!collection) return undefined;

      return transformCollection(collection);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { action: "get_collection", handle },
        level: "warning",
      });
      return undefined;
    }
  },
  ["medusa-collection"],
  {
    tags: [TAGS.collections],
    revalidate: CATALOG_REVALIDATE_SECONDS,
  },
);

export async function getCollection(
  handle: string,
): Promise<Collection | undefined> {
  return getCollectionCached(handle);
}

const getCollectionProductsCached = unstable_cache(
  async ({
    collection,
    reverse,
    sortKey,
  }: {
    collection: string;
    reverse?: boolean;
    sortKey?: string;
  }): Promise<Product[]> => {
    try {
      const { collections } = await sdk.client.fetch<{
        collections: HttpTypes.StoreCollection[];
      }>("/store/collections", {
        method: "GET",
        query: { handle: collection, fields: "*products", limit: 1 },
        cache: "force-cache",
        next: { tags: [TAGS.collections] },
      });

      const col = collections[0];
      if (!col) {
        console.log(`No collection found for \`${collection}\``);
        return [];
      }

      const region = await getDefaultRegion();
      const order = buildSortOrder(sortKey, reverse);

      const fetchQuery: ProductFetchQuery = {
        collection_id: [col.id],
        region_id: region.id,
        fields: PRODUCT_FIELDS,
        limit: 100,
      };

      if (order) fetchQuery.order = order;

      const { products } = await sdk.client.fetch<{
        products: HttpTypes.StoreProduct[];
      }>("/store/products", {
        method: "GET",
        query: fetchQuery,
        cache: "force-cache",
        next: { tags: [TAGS.products, TAGS.collections] },
      });

      return products.filter((p) => !isHiddenProduct(p)).map(transformProduct);
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          action: "get_collection_products",
          collection,
          sort_key: sortKey ?? "default",
        },
        level: "warning",
      });
      return [];
    }
  },
  ["medusa-collection-products"],
  {
    tags: [TAGS.collections, TAGS.products],
    revalidate: CATALOG_REVALIDATE_SECONDS,
  },
);

export async function getCollectionProducts({
  collection,
  reverse,
  sortKey,
}: {
  collection: string;
  reverse?: boolean;
  sortKey?: string;
}): Promise<Product[]> {
  return getCollectionProductsCached({ collection, reverse, sortKey });
}

export async function getCollections(): Promise<Collection[]> {
  "use cache";
  cacheTag(TAGS.collections);
  cacheLife("days");

  const allCollection: Collection = {
    handle: "",
    title: "All",
    description: "All products",
    seo: { title: "All", description: "All products" },
    path: "/products",
    updatedAt: new Date().toISOString(),
  };

  try {
    const { collections } = await sdk.client.fetch<{
      collections: HttpTypes.StoreCollection[];
    }>("/store/collections", {
      method: "GET",
      query: { limit: 100, fields: "+metadata" },
      cache: "force-cache",
      next: { tags: [TAGS.collections] },
    });

    const transformed = collections
      .filter((c) => !c.handle?.startsWith("hidden"))
      .map(transformCollection);

    return [allCollection, ...transformed];
  } catch (error) {
    Sentry.captureException(error, {
      tags: { action: "get_collections" },
      level: "warning",
    });
    return [allCollection];
  }
}

// --- Cart ---

/**
 * Fetch the current cart by ID with full line item details.
 * Shared by mutation functions that need to return the updated cart.
 */
async function fetchCart(cartId: string): Promise<Cart> {
  const headers = await getAuthHeaders();

  const { cart } = await sdk.client.fetch<{
    cart: HttpTypes.StoreCart;
  }>(`/store/carts/${cartId}`, {
    method: "GET",
    headers,
    query: { fields: CART_FIELDS },
  });

  return transformCart(cart);
}

async function requireCartId(context: string): Promise<string> {
  const cartId = await getCartId();
  if (!cartId) {
    throw new Error(`No cart ID found when ${context}`);
  }
  return cartId;
}

export async function createCart(): Promise<Cart> {
  const region = await getDefaultRegion();
  const headers = await getAuthHeaders();

  const { cart } = await sdk.store.cart.create(
    { region_id: region.id },
    {},
    headers,
  );

  await setCartId(cart.id);
  return transformCart(cart);
}

export async function getOrSetCart(): Promise<Cart> {
  const existingCartId = await getCartId();

  if (existingCartId) {
    const existing = await getCart();
    if (existing) return existing;
  }

  return createCart();
}

export async function addToCart(
  lines: { merchandiseId: string; quantity: number }[],
): Promise<Cart> {
  const cartId = await requireCartId("adding to cart");
  const headers = await getAuthHeaders();

  for (const line of lines) {
    if (!line.merchandiseId) {
      throw new Error("Missing variant ID when adding to cart");
    }
    if (line.quantity < 1) {
      throw new Error("Quantity must be at least 1");
    }

    await sdk.store.cart
      .createLineItem(
        cartId,
        { variant_id: line.merchandiseId, quantity: line.quantity },
        {},
        headers,
      )
      .catch(medusaError);
  }

  return fetchCart(cartId);
}

export async function removeFromCart(lineIds: string[]): Promise<Cart> {
  const cartId = await requireCartId("removing item");
  const headers = await getAuthHeaders();

  for (const lineId of lineIds) {
    if (!lineId) {
      throw new Error("Missing line item ID when removing from cart");
    }

    await sdk.store.cart
      .deleteLineItem(cartId, lineId, {}, headers)
      .catch(medusaError);
  }

  return fetchCart(cartId);
}

export async function updateCart(
  lines: {
    id: string;
    merchandiseId: string;
    quantity: number;
  }[],
): Promise<Cart> {
  const cartId = await requireCartId("updating cart");
  const headers = await getAuthHeaders();

  for (const line of lines) {
    await sdk.store.cart
      .updateLineItem(cartId, line.id, { quantity: line.quantity }, {}, headers)
      .catch(medusaError);
  }

  return fetchCart(cartId);
}

export async function getCart(): Promise<Cart | undefined> {
  const cartId = await getCartId();
  if (!cartId) return undefined;

  try {
    const defaultRegion = await getDefaultRegion();
    const headers = await getAuthHeaders();

    // Fetch the raw cart to check its region
    const { cart: rawCart } = await sdk.client
      .fetch<{
        cart: HttpTypes.StoreCart;
      }>(`/store/carts/${cartId}`, {
        method: "GET",
        headers,
        query: { fields: CART_FIELDS },
      })
      .catch(medusaError);

    // Reconcile stale carts created under a different region/currency
    if (rawCart.region_id !== defaultRegion.id) {
      await sdk.store.cart
        .update(cartId, { region_id: defaultRegion.id }, {}, headers)
        .catch(medusaError);
      return await fetchCart(cartId);
    }

    return transformCart(rawCart);
  } catch (error) {
    Sentry.captureException(error, { tags: { action: "get_cart" } });
    console.error(
      "[Cart] Failed to retrieve cart, clearing stale cookie:",
      error,
    );
    await removeCartId().catch(() => {});
    return undefined;
  }
}

// --- Orders ---

export type StoreOrderDetail = HttpTypes.StoreOrder & {
  status?: string;
  payment_status?: string;
  fulfillment_status?: string;
  payment_collections?: Array<{
    payments?: Array<{
      provider_id?: string;
      created_at?: string | Date;
      data?: {
        payment_method?: {
          card?: {
            brand?: string;
            last4?: string;
            exp_month?: number;
            exp_year?: number;
          };
        };
        card?: {
          brand?: string;
          last4?: string;
          exp_month?: number;
          exp_year?: number;
        };
      };
    }>;
    payment_sessions?: Array<{ provider_id?: string }>;
  }>;
  promotions?: Array<{ code?: string }>;
};

async function getE2EOrders(): Promise<StoreOrderDetail[] | null> {
  const cookieStore = await cookies();
  const fixturesEnabled =
    process.env.NODE_ENV !== "production" &&
    cookieStore.get("__e2e_orders_enabled")?.value === "1";

  if (!fixturesEnabled) return null;

  const encodedFixture = cookieStore.get("__e2e_orders")?.value;
  if (!encodedFixture) return null;

  try {
    const fixture = JSON.parse(decodeURIComponent(encodedFixture)) as {
      orders?: StoreOrderDetail[];
    };

    return Array.isArray(fixture.orders) ? fixture.orders : null;
  } catch (error) {
    console.error("[E2E] Failed to parse mocked order fixture:", error);
    return null;
  }
}

export async function getOrders(): Promise<HttpTypes.StoreOrder[]> {
  const headers = await getAuthHeaders();
  if (!headers.authorization) return [];

  const e2eOrders = await getE2EOrders();
  if (e2eOrders) return e2eOrders;

  try {
    const { orders } = await sdk.client.fetch<{
      orders: HttpTypes.StoreOrder[];
    }>("/store/orders", {
      method: "GET",
      headers,
      query: {
        limit: 50,
        order: "-created_at",
        fields: "+status,+payment_status,+fulfillment_status",
      },
    });
    return orders;
  } catch (error) {
    console.error("[Orders] Failed to retrieve orders:", error);
    return [];
  }
}

export async function getOrder(
  orderId: string,
): Promise<StoreOrderDetail | null> {
  const headers = await getAuthHeaders();
  if (!headers.authorization) return null;

  const e2eOrders = await getE2EOrders();
  if (e2eOrders) {
    return e2eOrders.find((order) => order.id === orderId) ?? null;
  }

  try {
    const { order } = await sdk.client
      .fetch<{ order: StoreOrderDetail }>(`/store/orders/${orderId}`, {
        method: "GET",
        headers,
        query: {
          fields:
            "*items,*items.variant,*items.product,*shipping_address,*billing_address,*shipping_methods,*payment_collections,*payment_collections.payments,*payment_collections.payment_sessions,*fulfillments,+status,+payment_status,+fulfillment_status,+promotions",
        },
      })
      .catch(medusaError);
    return order;
  } catch (error) {
    console.error("[Order] Failed to retrieve order:", error);
    return null;
  }
}

// --- Navigation ---

export async function getNavigation(): Promise<Navigation> {
  "use cache";
  cacheTag(TAGS.collections);
  cacheLife("days");

  const collections = await getCollections();

  if (collections.length <= 1) {
    return DEFAULT_NAVIGATION;
  }

  const collectionLinks = collections
    .filter((c) => c.handle !== "")
    .map((c) => ({ name: c.title, href: c.path }));

  return {
    categories:
      DEFAULT_NAVIGATION.categories.length > 0
        ? DEFAULT_NAVIGATION.categories
        : [
            {
              name: "Shop",
              featured: collectionLinks.slice(0, 3),
              categories: collectionLinks,
              collection: collectionLinks,
              brands: [],
            },
          ],
    pages: DEFAULT_NAVIGATION.pages,
  };
}

// --- Pages ---

export async function getPage(handle: string): Promise<Page | null> {
  const page = STATIC_PAGES.get(handle);
  return page ? { ...page } : null;
}

export async function getPages(): Promise<Page[]> {
  return Array.from(STATIC_PAGES.values(), (page) => ({ ...page }));
}

// --- Webhook Revalidation ---

export async function revalidate(req: NextRequest): Promise<NextResponse> {
  const secret =
    req.headers.get("x-revalidate-secret") ??
    req.nextUrl.searchParams.get("secret");
  const expectedSecret = sanitizeEnvValue(process.env.REVALIDATE_SECRET);

  if (!secret || !expectedSecret || secret !== expectedSecret) {
    console.error("Invalid revalidation secret.");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  revalidateTag(TAGS.collections, "max");
  revalidateTag(TAGS.products, "max");
  revalidateTag(TAGS.cart, "max");
  revalidateTag(TAGS.reviews, "max");

  return NextResponse.json({
    status: 200,
    revalidated: true,
    now: Date.now(),
  });
}
