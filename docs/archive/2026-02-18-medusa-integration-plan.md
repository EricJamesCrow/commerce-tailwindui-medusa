# Medusa.js Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Shopify with Medusa.js as the commerce backend (Phase 1: Catalog + Cart).

**Architecture:** Thin adapter layer in `lib/medusa/` that exports the same function signatures as the old `lib/shopify/`. Public types extracted to `lib/types.ts` so components only need import path changes. Medusa JS SDK handles all API communication, and transform functions convert Medusa responses to the existing internal type contracts.

**Tech Stack:** Next.js 16, React 19, `@medusajs/js-sdk`, `@medusajs/types`, TypeScript

**Reference code:** The official Medusa Next.js starter is at `references/nextjs-starter-medusa/` — use it for SDK call patterns.

---

### Task 1: Install Medusa Dependencies

**Files:**

- Modify: `package.json`

**Step 1: Install packages**

Run:

```bash
pnpm add @medusajs/js-sdk
pnpm add -D @medusajs/types
```

**Step 2: Verify installation**

Run: `pnpm ls @medusajs/js-sdk @medusajs/types`
Expected: Both packages listed with versions

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add @medusajs/js-sdk and @medusajs/types dependencies"
```

---

### Task 2: Extract Public Types to `lib/types.ts`

**Files:**

- Create: `lib/types.ts`
- Reference: `lib/shopify/types.ts` (lines 11-96, 275-291)

Extract the backend-agnostic public types that components consume. These are the types that do NOT reference `ShopifyCart`, `ShopifyProduct`, `ShopifyCollection`, or `Connection<T>`. The Shopify-specific types stay in `lib/shopify/types.ts` until we delete it in a later task.

**Step 1: Create `lib/types.ts`**

```typescript
export type Cart = {
  id: string | undefined;
  checkoutUrl: string;
  cost: {
    subtotalAmount: Money;
    totalAmount: Money;
    totalTaxAmount: Money;
  };
  lines: CartItem[];
  totalQuantity: number;
};

export type CartProduct = {
  id: string;
  handle: string;
  title: string;
  featuredImage: Image;
};

export type CartItem = {
  id: string | undefined;
  quantity: number;
  cost: {
    totalAmount: Money;
  };
  merchandise: {
    id: string;
    title: string;
    selectedOptions: {
      name: string;
      value: string;
    }[];
    product: CartProduct;
  };
};

export type Collection = {
  handle: string;
  title: string;
  description: string;
  seo: SEO;
  updatedAt: string;
  path: string;
  image?: Image;
};

export type Image = {
  url: string;
  altText: string;
  width: number;
  height: number;
};

export type Menu = {
  title: string;
  path: string;
};

export type Money = {
  amount: string;
  currencyCode: string;
};

export type Page = {
  id: string;
  title: string;
  handle: string;
  body: string;
  bodySummary: string;
  seo?: SEO;
  createdAt: string;
  updatedAt: string;
};

export type Product = {
  id: string;
  handle: string;
  availableForSale: boolean;
  title: string;
  description: string;
  descriptionHtml: string;
  options: ProductOption[];
  priceRange: {
    maxVariantPrice: Money;
    minVariantPrice: Money;
  };
  variants: ProductVariant[];
  featuredImage: Image;
  images: Image[];
  seo: SEO;
  tags: string[];
  updatedAt: string;
};

export type ProductOption = {
  id: string;
  name: string;
  values: string[];
};

export type ProductVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  selectedOptions: {
    name: string;
    value: string;
  }[];
  price: Money;
};

export type SEO = {
  title: string;
  description: string;
};

export type NavigationLink = {
  name: string;
  href: string;
};

export type NavigationCategory = {
  name: string;
  featured: NavigationLink[];
  categories: NavigationLink[];
  collection: NavigationLink[];
  brands: NavigationLink[];
};

export type Navigation = {
  categories: NavigationCategory[];
  pages: NavigationLink[];
};
```

**Key difference from `lib/shopify/types.ts`:** `Cart` is now a flat type (no `Omit<ShopifyCart, ...>`), `Product` is flat (no `Omit<ShopifyProduct, ...>`), and `Collection` includes `path` directly (no `ShopifyCollection & { path }`).

**Step 2: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit --pretty 2>&1 | head -20`
Expected: May have errors from unchanged import paths — that's fine. The new file itself should have no errors.

**Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: extract backend-agnostic types to lib/types.ts"
```

---

### Task 3: Create Medusa SDK Client and Region Helper

**Files:**

- Create: `lib/medusa/index.ts` (initial — SDK client + region helper only)

**Step 1: Create `lib/medusa/index.ts` with SDK client and region caching**

```typescript
import Medusa from "@medusajs/js-sdk";
import type { HttpTypes } from "@medusajs/types";

const MEDUSA_BACKEND_URL =
  process.env.MEDUSA_BACKEND_URL || "http://localhost:9000";

export const sdk = new Medusa({
  baseUrl: MEDUSA_BACKEND_URL,
  debug: process.env.NODE_ENV === "development",
  publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
});

// Single-region: cache the default region after first fetch
let cachedRegion: HttpTypes.StoreRegion | null = null;

export async function getDefaultRegion(): Promise<HttpTypes.StoreRegion> {
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

  // Use the first region as default (single-region mode)
  cachedRegion = regions[0]!;
  return cachedRegion;
}
```

**Step 2: Verify file compiles**

Run: `pnpm exec tsc --noEmit --pretty 2>&1 | grep 'lib/medusa'`
Expected: No errors from `lib/medusa/index.ts`

**Step 3: Commit**

```bash
git add lib/medusa/index.ts
git commit -m "feat: add Medusa SDK client and region helper"
```

---

### Task 4: Create Medusa Transform Functions

**Files:**

- Create: `lib/medusa/transforms.ts`
- Reference: `lib/types.ts` (created in Task 2)
- Reference: `references/nextjs-starter-medusa/src/lib/data/products.ts` for Medusa type shapes

These functions convert Medusa API responses (`HttpTypes.StoreProduct`, `HttpTypes.StoreCart`, `HttpTypes.StoreCollection`) into the internal types that components consume.

**Step 1: Create `lib/medusa/transforms.ts`**

```typescript
import type { HttpTypes } from "@medusajs/types";
import type {
  Cart,
  CartItem,
  Collection,
  Image,
  Money,
  Product,
  ProductOption,
  ProductVariant,
} from "lib/types";

/**
 * Convert Medusa integer cents to Money string format.
 * Medusa stores amounts as integers (e.g., 2999 = $29.99).
 * Our internal types use string amounts (e.g., "29.99").
 */
function toMoney(
  amount: number | undefined | null,
  currencyCode: string,
): Money {
  return {
    amount: ((amount ?? 0) / 100).toFixed(2),
    currencyCode: currencyCode.toUpperCase(),
  };
}

/**
 * Get the currency code from a Medusa product's first variant's calculated price.
 */
function getCurrencyCode(product: HttpTypes.StoreProduct): string {
  const variant = product.variants?.[0];
  return (variant as any)?.calculated_price?.currency_code || "USD";
}

/**
 * Transform a Medusa product image to our internal Image type.
 */
function transformImage(
  image: HttpTypes.StoreProductImage,
  fallbackAlt: string,
): Image {
  return {
    url: image.url || "",
    altText: fallbackAlt,
    width: 0, // Medusa doesn't store image dimensions
    height: 0,
  };
}

/**
 * Transform a Medusa product variant to our internal ProductVariant type.
 */
function transformVariant(
  variant: HttpTypes.StoreProductVariant,
  currencyCode: string,
): ProductVariant {
  const calculatedPrice = (variant as any)?.calculated_price;
  const amount = calculatedPrice?.calculated_amount ?? 0;
  const inventoryQuantity = (variant as any)?.inventory_quantity ?? 0;
  const manageInventory = variant.manage_inventory ?? false;

  return {
    id: variant.id || "",
    title: variant.title || "",
    availableForSale: !manageInventory || inventoryQuantity > 0,
    selectedOptions: (variant.options || []).map((opt) => ({
      name: opt.option?.title || "",
      value: opt.value || "",
    })),
    price: toMoney(amount, currencyCode),
  };
}

/**
 * Transform a Medusa product option to our internal ProductOption type.
 */
function transformOption(option: HttpTypes.StoreProductOption): ProductOption {
  return {
    id: option.id || "",
    name: option.title || "",
    values: (option.values || []).map((v) => v.value || ""),
  };
}

/**
 * Transform a Medusa StoreProduct to our internal Product type.
 */
export function transformProduct(product: HttpTypes.StoreProduct): Product {
  const currencyCode = getCurrencyCode(product);
  const variants = (product.variants || []).map((v) =>
    transformVariant(v, currencyCode),
  );
  const images = (product.images || []).map((img) =>
    transformImage(img, product.title || ""),
  );

  // Compute price range from variants
  const prices = variants.map((v) => parseFloat(v.price.amount));
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 0;

  const featuredImage: Image = product.thumbnail
    ? {
        url: product.thumbnail,
        altText: product.title || "",
        width: 0,
        height: 0,
      }
    : images[0] || {
        url: "",
        altText: product.title || "",
        width: 0,
        height: 0,
      };

  // Extract tags from product metadata or tags field
  const tags: string[] = (product.tags || []).map(
    (t) => (t as any).value || (t as any).name || String(t),
  );

  return {
    id: product.id || "",
    handle: product.handle || "",
    availableForSale: variants.some((v) => v.availableForSale),
    title: product.title || "",
    description: product.description || "",
    descriptionHtml: product.description || "",
    options: (product.options || []).map(transformOption),
    priceRange: {
      minVariantPrice: toMoney(minPrice * 100, currencyCode),
      maxVariantPrice: toMoney(maxPrice * 100, currencyCode),
    },
    variants,
    featuredImage,
    images,
    seo: {
      title: (product.metadata?.seo_title as string) || product.title || "",
      description:
        (product.metadata?.seo_description as string) ||
        product.description ||
        "",
    },
    tags,
    updatedAt: product.updated_at || new Date().toISOString(),
  };
}

/**
 * Transform a Medusa StoreCollection to our internal Collection type.
 */
export function transformCollection(
  collection: HttpTypes.StoreCollection,
): Collection {
  return {
    handle: collection.handle || "",
    title: collection.title || "",
    description: (collection.metadata?.description as string) || "",
    seo: {
      title:
        (collection.metadata?.seo_title as string) || collection.title || "",
      description:
        (collection.metadata?.seo_description as string) ||
        (collection.metadata?.description as string) ||
        "",
    },
    updatedAt: collection.updated_at || new Date().toISOString(),
    path: `/products/${collection.handle}`,
    image: collection.metadata?.image_url
      ? {
          url: collection.metadata.image_url as string,
          altText: collection.title || "",
          width: 0,
          height: 0,
        }
      : undefined,
  };
}

/**
 * Transform a Medusa StoreCart to our internal Cart type.
 */
export function transformCart(cart: HttpTypes.StoreCart): Cart {
  const currencyCode = cart.currency_code || "USD";

  const lines: CartItem[] = (cart.items || []).map((item) => {
    const product = item.product;
    const variant = item.variant;

    return {
      id: item.id,
      quantity: item.quantity || 0,
      cost: {
        totalAmount: toMoney(item.total, currencyCode),
      },
      merchandise: {
        id: variant?.id || item.variant_id || "",
        title: variant?.title || item.title || "",
        selectedOptions: (variant?.options || []).map((opt) => ({
          name: opt.option?.title || "",
          value: opt.value || "",
        })),
        product: {
          id: product?.id || item.product_id || "",
          handle: product?.handle || "",
          title: product?.title || item.title || "",
          featuredImage: {
            url: item.thumbnail || product?.thumbnail || "",
            altText: product?.title || item.title || "",
            width: 0,
            height: 0,
          },
        },
      },
    };
  });

  return {
    id: cart.id,
    checkoutUrl: "", // Checkout deferred to future phase
    cost: {
      subtotalAmount: toMoney(cart.subtotal, currencyCode),
      totalAmount: toMoney(cart.total, currencyCode),
      totalTaxAmount: toMoney(cart.tax_total, currencyCode),
    },
    lines,
    totalQuantity: lines.reduce((sum, line) => sum + line.quantity, 0),
  };
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit --pretty 2>&1 | grep 'lib/medusa/transforms'`
Expected: No errors from this file

**Step 3: Commit**

```bash
git add lib/medusa/transforms.ts
git commit -m "feat: add Medusa-to-internal type transform functions"
```

---

### Task 5: Implement Product and Collection Data Functions

**Files:**

- Modify: `lib/medusa/index.ts`

Add product and collection fetching functions that match the existing `lib/shopify/index.ts` signatures.

**Step 1: Add product and collection functions to `lib/medusa/index.ts`**

Append after the existing `getDefaultRegion()` function:

```typescript
import { HIDDEN_PRODUCT_TAG, TAGS } from "lib/constants";
import { cacheLife, cacheTag } from "next/cache";
import type { Collection, Product } from "lib/types";
import { transformProduct, transformCollection } from "./transforms";

export async function getProduct(handle: string): Promise<Product | undefined> {
  "use cache";
  cacheTag(TAGS.products);
  cacheLife("days");

  const region = await getDefaultRegion();

  const { products } = await sdk.client.fetch<{
    products: HttpTypes.StoreProduct[];
  }>("/store/products", {
    method: "GET",
    query: {
      handle,
      region_id: region.id,
      fields:
        "*variants.calculated_price,+variants.inventory_quantity,*variants.images,+metadata,+tags",
      limit: 1,
    },
    cache: "force-cache",
  });

  const product = products[0];
  if (!product) return undefined;

  return transformProduct(product);
}

export async function getProducts({
  query,
  reverse,
  sortKey,
}: {
  query?: string;
  reverse?: boolean;
  sortKey?: string;
}): Promise<Product[]> {
  "use cache";
  cacheTag(TAGS.products);
  cacheLife("days");

  const region = await getDefaultRegion();

  // Map Shopify sort keys to Medusa order params
  let order: string | undefined;
  if (sortKey === "PRICE") {
    order = reverse
      ? "-variants.calculated_price.calculated_amount"
      : "variants.calculated_price.calculated_amount";
  } else if (sortKey === "CREATED_AT") {
    order = reverse ? "-created_at" : "created_at";
  } else if (sortKey === "BEST_SELLING") {
    // Medusa doesn't have a direct "best selling" sort — fall back to created_at
    order = "-created_at";
  }

  const fetchQuery: Record<string, any> = {
    region_id: region.id,
    fields:
      "*variants.calculated_price,+variants.inventory_quantity,*variants.images,+metadata,+tags",
    limit: 100,
  };

  if (query) fetchQuery.q = query;
  if (order) fetchQuery.order = order;

  const { products } = await sdk.client.fetch<{
    products: HttpTypes.StoreProduct[];
  }>("/store/products", {
    method: "GET",
    query: fetchQuery,
    cache: "force-cache",
  });

  return products
    .filter((p) => {
      const tags = (p.tags || []).map(
        (t: any) => t.value || t.name || String(t),
      );
      return !tags.includes(HIDDEN_PRODUCT_TAG);
    })
    .map(transformProduct);
}

export async function getProductRecommendations(
  productId: string,
): Promise<Product[]> {
  "use cache";
  cacheTag(TAGS.products);
  cacheLife("days");

  // Medusa has no native recommendations endpoint.
  // Fetch recent products as a simple fallback.
  const region = await getDefaultRegion();

  const { products } = await sdk.client.fetch<{
    products: HttpTypes.StoreProduct[];
  }>("/store/products", {
    method: "GET",
    query: {
      region_id: region.id,
      fields:
        "*variants.calculated_price,+variants.inventory_quantity,*variants.images,+metadata,+tags",
      limit: 5,
      order: "-created_at",
    },
    cache: "force-cache",
  });

  // Filter out the current product
  return products
    .filter((p) => p.id !== productId)
    .slice(0, 4)
    .map(transformProduct);
}

export async function getCollection(
  handle: string,
): Promise<Collection | undefined> {
  "use cache";
  cacheTag(TAGS.collections);
  cacheLife("days");

  const { collections } = await sdk.client.fetch<{
    collections: HttpTypes.StoreCollection[];
  }>("/store/collections", {
    method: "GET",
    query: { handle, limit: 1 },
    cache: "force-cache",
  });

  const collection = collections[0];
  if (!collection) return undefined;

  return transformCollection(collection);
}

export async function getCollectionProducts({
  collection,
  reverse,
  sortKey,
}: {
  collection: string;
  reverse?: boolean;
  sortKey?: string;
}): Promise<Product[]> {
  "use cache";
  cacheTag(TAGS.collections, TAGS.products);
  cacheLife("days");

  // First, find the collection by handle
  const { collections } = await sdk.client.fetch<{
    collections: HttpTypes.StoreCollection[];
  }>("/store/collections", {
    method: "GET",
    query: { handle: collection, fields: "*products", limit: 1 },
    cache: "force-cache",
  });

  const col = collections[0];
  if (!col) {
    console.log(`No collection found for \`${collection}\``);
    return [];
  }

  // Fetch products in this collection with pricing
  const region = await getDefaultRegion();

  let order: string | undefined;
  if (sortKey === "PRICE") {
    order = reverse
      ? "-variants.calculated_price.calculated_amount"
      : "variants.calculated_price.calculated_amount";
  } else if (sortKey === "CREATED_AT" || sortKey === "CREATED") {
    order = reverse ? "-created_at" : "created_at";
  }

  const fetchQuery: Record<string, any> = {
    collection_id: [col.id],
    region_id: region.id,
    fields:
      "*variants.calculated_price,+variants.inventory_quantity,*variants.images,+metadata,+tags",
    limit: 100,
  };

  if (order) fetchQuery.order = order;

  const { products } = await sdk.client.fetch<{
    products: HttpTypes.StoreProduct[];
  }>("/store/products", {
    method: "GET",
    query: fetchQuery,
    cache: "force-cache",
  });

  return products
    .filter((p) => {
      const tags = (p.tags || []).map(
        (t: any) => t.value || t.name || String(t),
      );
      return !tags.includes(HIDDEN_PRODUCT_TAG);
    })
    .map(transformProduct);
}

export async function getCollections(): Promise<Collection[]> {
  "use cache";
  cacheTag(TAGS.collections);
  cacheLife("days");

  const { collections } = await sdk.client.fetch<{
    collections: HttpTypes.StoreCollection[];
  }>("/store/collections", {
    method: "GET",
    query: { limit: 100 },
    cache: "force-cache",
  });

  const allCollection: Collection = {
    handle: "",
    title: "All",
    description: "All products",
    seo: { title: "All", description: "All products" },
    path: "/products",
    updatedAt: new Date().toISOString(),
  };

  const transformed = collections
    .filter((c) => !c.handle?.startsWith("hidden"))
    .map(transformCollection);

  return [allCollection, ...transformed];
}
```

**Step 2: Verify file compiles**

Run: `pnpm exec tsc --noEmit --pretty 2>&1 | grep 'lib/medusa'`
Expected: No errors from `lib/medusa/` files

**Step 3: Commit**

```bash
git add lib/medusa/index.ts
git commit -m "feat: add product and collection data functions for Medusa"
```

---

### Task 6: Implement Cart Data Functions

**Files:**

- Modify: `lib/medusa/index.ts`

Add cart functions that match the current `lib/shopify/index.ts` cart signatures.

**Step 1: Add cart functions to `lib/medusa/index.ts`**

Append:

```typescript
import { cookies } from "next/headers";
import type { Cart } from "lib/types";
import { transformCart } from "./transforms";

export async function createCart(): Promise<Cart> {
  const region = await getDefaultRegion();

  const { cart } = await sdk.store.cart.create({
    region_id: region.id,
  });

  return transformCart(cart);
}

export async function addToCart(
  lines: { merchandiseId: string; quantity: number }[],
): Promise<Cart> {
  const cartId = (await cookies()).get("cartId")?.value;

  if (!cartId) {
    throw new Error("No cart ID found in cookies");
  }

  // Medusa adds one line item at a time
  for (const line of lines) {
    await sdk.store.cart.createLineItem(cartId, {
      variant_id: line.merchandiseId,
      quantity: line.quantity,
    });
  }

  // Fetch updated cart
  const { cart } = await sdk.client.fetch<{ cart: HttpTypes.StoreCart }>(
    `/store/carts/${cartId}`,
    {
      method: "GET",
      query: {
        fields:
          "*items,*items.product,*items.variant,*items.thumbnail,+items.total",
      },
    },
  );

  return transformCart(cart);
}

export async function removeFromCart(lineIds: string[]): Promise<Cart> {
  const cartId = (await cookies()).get("cartId")?.value;

  if (!cartId) {
    throw new Error("No cart ID found in cookies");
  }

  for (const lineId of lineIds) {
    await sdk.store.cart.deleteLineItem(cartId, lineId);
  }

  const { cart } = await sdk.client.fetch<{ cart: HttpTypes.StoreCart }>(
    `/store/carts/${cartId}`,
    {
      method: "GET",
      query: {
        fields:
          "*items,*items.product,*items.variant,*items.thumbnail,+items.total",
      },
    },
  );

  return transformCart(cart);
}

export async function updateCart(
  lines: { id: string; merchandiseId: string; quantity: number }[],
): Promise<Cart> {
  const cartId = (await cookies()).get("cartId")?.value;

  if (!cartId) {
    throw new Error("No cart ID found in cookies");
  }

  for (const line of lines) {
    await sdk.store.cart.updateLineItem(cartId, line.id, {
      quantity: line.quantity,
    });
  }

  const { cart } = await sdk.client.fetch<{ cart: HttpTypes.StoreCart }>(
    `/store/carts/${cartId}`,
    {
      method: "GET",
      query: {
        fields:
          "*items,*items.product,*items.variant,*items.thumbnail,+items.total",
      },
    },
  );

  return transformCart(cart);
}

export async function getCart(): Promise<Cart | undefined> {
  const cartId = (await cookies()).get("cartId")?.value;

  if (!cartId) {
    return undefined;
  }

  try {
    const { cart } = await sdk.client.fetch<{ cart: HttpTypes.StoreCart }>(
      `/store/carts/${cartId}`,
      {
        method: "GET",
        query: {
          fields:
            "*items,*items.product,*items.variant,*items.thumbnail,+items.total",
        },
      },
    );

    if (!cart) return undefined;

    return transformCart(cart);
  } catch {
    // Cart may have been completed or expired
    return undefined;
  }
}
```

**Step 2: Verify file compiles**

Run: `pnpm exec tsc --noEmit --pretty 2>&1 | grep 'lib/medusa'`
Expected: No errors

**Step 3: Commit**

```bash
git add lib/medusa/index.ts
git commit -m "feat: add cart data functions for Medusa"
```

---

### Task 7: Implement Navigation, Pages, Menu, and Revalidation

**Files:**

- Modify: `lib/medusa/index.ts`

These are the remaining functions needed to complete the adapter API surface.

**Step 1: Add navigation, pages, menu, and revalidation functions**

Append to `lib/medusa/index.ts`:

```typescript
import { DEFAULT_NAVIGATION } from "lib/constants/navigation";
import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import type { Menu, Navigation, Page } from "lib/types";

export async function getNavigation(): Promise<Navigation> {
  "use cache";
  cacheTag(TAGS.collections);
  cacheLife("days");

  // Medusa has no metaobjects — build navigation from collections
  const collections = await getCollections();

  if (collections.length <= 1) {
    // Only "All" synthetic collection — use default
    return DEFAULT_NAVIGATION;
  }

  // Build a simple navigation from collections
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

export async function getMenu(handle: string): Promise<Menu[]> {
  "use cache";
  cacheTag(TAGS.collections);
  cacheLife("days");

  // Medusa has no native menu system.
  // Build from collections for product menus, or return empty for others.
  if (handle.includes("footer")) {
    const collections = await getCollections();
    return collections
      .filter((c) => c.handle !== "")
      .slice(0, 6)
      .map((c) => ({ title: c.title, path: c.path }));
  }

  return [];
}

export async function getPage(handle: string): Promise<Page> {
  // Medusa has no native pages system.
  // Return a placeholder — the [page] route will handle 404 gracefully.
  return {
    id: "",
    title: "",
    handle,
    body: "",
    bodySummary: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function getPages(): Promise<Page[]> {
  // No native pages in Medusa
  return [];
}

/**
 * Handle Medusa webhook revalidation requests.
 * Medusa sends webhooks for product/collection changes.
 */
export async function revalidate(req: NextRequest): Promise<NextResponse> {
  const secret = req.nextUrl.searchParams.get("secret");

  if (!secret || secret !== process.env.REVALIDATE_SECRET) {
    console.error("Invalid revalidation secret.");
    return NextResponse.json({ status: 401 });
  }

  // Medusa webhook payloads include the entity type in the URL or body
  // For simplicity, revalidate both products and collections on any webhook
  revalidateTag(TAGS.collections, "max");
  revalidateTag(TAGS.products, "max");
  revalidateTag(TAGS.cart, "max");

  return NextResponse.json({
    status: 200,
    revalidated: true,
    now: Date.now(),
  });
}
```

**Step 2: Verify file compiles**

Run: `pnpm exec tsc --noEmit --pretty 2>&1 | grep 'lib/medusa'`
Expected: No errors

**Step 3: Commit**

```bash
git add lib/medusa/index.ts
git commit -m "feat: add navigation, pages, menu, and revalidation for Medusa"
```

---

### Task 8: Update `lib/utils.ts`

**Files:**

- Modify: `lib/utils.ts`

Update imports to use `lib/types` instead of `lib/shopify/types`. Rename transformer functions to remove "Shopify" prefix. Update `validateEnvironmentVariables()` for Medusa env vars.

**Step 1: Update imports**

Change line 6:

```typescript
// OLD:
import type { Collection, Menu, Product } from "./shopify/types";
// NEW:
import type { Collection, Menu, Product } from "./types";
```

**Step 2: Rename transformer functions**

Find and replace (4 functions):

- `transformShopifyProductToTailwind` → `transformProductToTailwind`
- `transformShopifyCollectionToTailwind` → `transformCollectionToTailwind`
- `transformShopifyProductToTailwindDetail` → `transformProductToTailwindDetail`
- `transformShopifyProductsToRelatedProducts` → `transformProductsToRelatedProducts`

**Step 3: Update `validateEnvironmentVariables()`**

Replace the function body to check Medusa env vars:

```typescript
export const validateEnvironmentVariables = () => {
  const requiredEnvironmentVariables = [
    "MEDUSA_BACKEND_URL",
    "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY",
  ];
  const missingEnvironmentVariables = [] as string[];

  requiredEnvironmentVariables.forEach((envVar) => {
    if (!process.env[envVar]) {
      missingEnvironmentVariables.push(envVar);
    }
  });

  if (missingEnvironmentVariables.length) {
    throw new Error(
      `The following environment variables are missing. Your site will not work without them.\n\n${missingEnvironmentVariables.join("\n")}\n`,
    );
  }
};
```

**Step 4: Verify file compiles**

Run: `pnpm exec tsc --noEmit --pretty 2>&1 | grep 'lib/utils'`
Expected: No errors from this file

**Step 5: Commit**

```bash
git add lib/utils.ts
git commit -m "refactor: update lib/utils.ts for Medusa (rename transformers, update env validation)"
```

---

### Task 9: Update `lib/constants.ts`

**Files:**

- Modify: `lib/constants.ts`

Remove the Shopify-specific `SHOPIFY_GRAPHQL_API_ENDPOINT` constant. Keep everything else.

**Step 1: Remove Shopify constant**

Delete line 51 (`export const SHOPIFY_GRAPHQL_API_ENDPOINT = "/api/2023-01/graphql.json";`).

Keep `TAGS`, `HIDDEN_PRODUCT_TAG`, `DEFAULT_OPTION`, and `sorting`/`defaultSort` unchanged.

**Step 2: Commit**

```bash
git add lib/constants.ts
git commit -m "refactor: remove SHOPIFY_GRAPHQL_API_ENDPOINT from constants"
```

---

### Task 10: Update `components/cart/actions.ts`

**Files:**

- Modify: `components/cart/actions.ts`

Change imports from `lib/shopify` to `lib/medusa`. Update `redirectToCheckout()` to redirect to `/cart` instead of Shopify's hosted checkout.

**Step 1: Update imports**

Change line 4-9:

```typescript
// OLD:
import {
  addToCart,
  createCart,
  getCart,
  removeFromCart,
  updateCart,
} from "lib/shopify";

// NEW:
import {
  addToCart,
  createCart,
  getCart,
  removeFromCart,
  updateCart,
} from "lib/medusa";
```

**Step 2: Update `redirectToCheckout()`**

Change lines 101-104:

```typescript
// OLD:
export async function redirectToCheckout() {
  let cart = await getCart();
  redirect(cart!.checkoutUrl);
}

// NEW:
export async function redirectToCheckout() {
  // Checkout not yet implemented with Medusa — redirect to cart
  redirect("/cart");
}
```

Since `getCart` is no longer called, the unused import won't be an issue (it's still used in `removeItem` and `updateItemQuantity`).

**Step 3: Commit**

```bash
git add components/cart/actions.ts
git commit -m "refactor: update cart actions to use Medusa backend"
```

---

### Task 11: Update All Component Type Imports

**Files to modify (16 files):**

All files that import from `lib/shopify/types` need to import from `lib/types` instead.

**Step 1: Update each file's import**

For each of these files, change `from "lib/shopify/types"` (or `from "./shopify/types"`) to `from "lib/types"`:

| File                                               | Old import path     | New import path |
| -------------------------------------------------- | ------------------- | --------------- |
| `components/cart/add-to-cart.tsx`                  | `lib/shopify/types` | `lib/types`     |
| `components/cart/cart-context.tsx`                 | `lib/shopify/types` | `lib/types`     |
| `components/cart/delete-item-button.tsx`           | `lib/shopify/types` | `lib/types`     |
| `components/cart/edit-item-quantity-button.tsx`    | `lib/shopify/types` | `lib/types`     |
| `components/layout/navbar/navbar-client.tsx`       | `lib/shopify/types` | `lib/types`     |
| `components/layout/product-grid.tsx`               | `lib/shopify/types` | `lib/types`     |
| `components/page/page-content.tsx`                 | `lib/shopify/types` | `lib/types`     |
| `components/product/product-detail.tsx`            | `lib/shopify/types` | `lib/types`     |
| `components/product/product-page-content.tsx`      | `lib/shopify/types` | `lib/types`     |
| `components/product/product-wrapper.tsx`           | `lib/shopify/types` | `lib/types`     |
| `components/product/related-products.tsx`          | `lib/shopify/types` | `lib/types`     |
| `components/product/template-variant-selector.tsx` | `lib/shopify/types` | `lib/types`     |
| `components/search-command/actions.ts`             | `lib/shopify/types` | `lib/types`     |
| `components/search-command/product-result.tsx`     | `lib/shopify/types` | `lib/types`     |
| `components/search-command/use-search.tsx`         | `lib/shopify/types` | `lib/types`     |

Also update `lib/utils.ts` if not already done in Task 8 (it was — `./shopify/types` → `./types`).

**Step 2: Verify no remaining references to `lib/shopify/types`**

Run: `grep -r "shopify/types" --include="*.ts" --include="*.tsx" lib/ components/ app/`
Expected: No results (or only in `lib/shopify/types.ts` itself which we'll delete)

**Step 3: Commit**

```bash
git add components/ lib/utils.ts
git commit -m "refactor: update all component type imports from lib/shopify/types to lib/types"
```

---

### Task 12: Update All Page and Route Function Imports

**Files to modify (data function imports):**

All files that import data functions from `lib/shopify` need to import from `lib/medusa`.

| File                                                  | Functions imported                                         |
| ----------------------------------------------------- | ---------------------------------------------------------- |
| `app/layout.tsx`                                      | `getCart`                                                  |
| `app/page.tsx`                                        | `getProducts`, `getCollections`                            |
| `app/sitemap.ts`                                      | `getCollections`, `getProducts`, `getPages`                |
| `app/product/[handle]/page.tsx`                       | `getProduct`, `getProductRecommendations`, `getProducts`   |
| `app/[page]/page.tsx`                                 | `getPage`                                                  |
| `app/[page]/opengraph-image.tsx`                      | `getPage`                                                  |
| `app/(store)/products/page.tsx`                       | `getProducts`                                              |
| `app/(store)/products/[collection]/page.tsx`          | `getCollection`, `getCollectionProducts`, `getCollections` |
| `app/(store)/search/page.tsx`                         | `getProducts`                                              |
| `app/(store)/search/[collection]/opengraph-image.tsx` | `getCollection`                                            |
| `app/api/revalidate/route.ts`                         | `revalidate`                                               |
| `components/layout/navbar/navbar-data.tsx`            | `getNavigation`                                            |
| `components/layout/footer/footer-navigation.tsx`      | `getCollections`, `getMenu`                                |
| `components/layout/search/collections.tsx`            | `getCollections`                                           |
| `components/layout/search/mobile-filters-wrapper.tsx` | `getCollections`                                           |
| `components/search-command/actions.ts`                | `getProducts`                                              |

**Step 1: Find-and-replace import paths**

In every file above, change:

```typescript
from "lib/shopify"    →    from "lib/medusa"
```

**Step 2: Also update transformer function names where called**

In any page/component files that call the renamed transformer functions:

- `transformShopifyProductToTailwind` → `transformProductToTailwind`
- `transformShopifyCollectionToTailwind` → `transformCollectionToTailwind`
- `transformShopifyProductToTailwindDetail` → `transformProductToTailwindDetail`
- `transformShopifyProductsToRelatedProducts` → `transformProductsToRelatedProducts`

Search for all usages:
Run: `grep -r "transformShopify" --include="*.ts" --include="*.tsx" app/ components/`

Update each usage to the new name.

**Step 3: Verify no remaining references to `lib/shopify`**

Run: `grep -r "from.*lib/shopify" --include="*.ts" --include="*.tsx" app/ components/`
Expected: No results

**Step 4: Commit**

```bash
git add app/ components/
git commit -m "refactor: update all page and component imports from lib/shopify to lib/medusa"
```

---

### Task 13: Update Configuration Files

**Files:**

- Modify: `.env.example`
- Modify: `next.config.ts`

**Step 1: Update `.env.example`**

Replace contents:

```
COMPANY_NAME="Your Company"
SITE_NAME="Your Store Name"
MEDUSA_BACKEND_URL="http://localhost:9000"
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=""
REVALIDATE_SECRET=""
```

**Step 2: Update `next.config.ts`**

Replace `cdn.shopify.com` pattern with Medusa-compatible patterns:

```typescript
export default {
  cacheComponents: true,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "medusa-public-images.s3.eu-west-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "medusa-server-testing.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "via.placeholder.com",
      },
      {
        protocol: "https",
        hostname: "tailwindcss.com",
        pathname: "/plus-assets/**",
      },
    ],
  },
};
```

**Step 3: Commit**

```bash
git add .env.example next.config.ts
git commit -m "chore: update env config and image patterns for Medusa"
```

---

### Task 14: Update `lib/type-guards.ts`

**Files:**

- Modify: `lib/type-guards.ts`

Rename types and functions to be backend-agnostic since they're no longer Shopify-specific.

**Step 1: Rename types**

```typescript
// OLD:
export interface ShopifyErrorLike { ... }
export const isShopifyError = ...

// NEW:
export interface ApiErrorLike {
  status: number;
  message: Error;
  cause?: Error;
}

export const isApiError = (error: unknown): error is ApiErrorLike => {
  if (!isObject(error)) return false;
  if (error instanceof Error) return true;
  return findError(error);
};
```

Keep `isObject` and `findError` unchanged.

**Step 2: Check if anything imports these**

Run: `grep -r "isShopifyError\|ShopifyErrorLike" --include="*.ts" --include="*.tsx" lib/ app/ components/`

The only reference should be `lib/shopify/index.ts` which we're about to delete. If there are other references, update them.

**Step 3: Commit**

```bash
git add lib/type-guards.ts
git commit -m "refactor: rename ShopifyErrorLike to ApiErrorLike in type-guards"
```

---

### Task 15: Update `lib/constants/navigation.ts`

**Files:**

- Modify: `lib/constants/navigation.ts`

Remove the redundant `NavigationLink`, `NavigationCategory`, and `Navigation` type definitions since they now live in `lib/types.ts`. Import them instead.

**Step 1: Update the file**

Replace the type definitions with imports:

```typescript
import type { Navigation, NavigationLink } from "lib/types";
```

Keep `DEFAULT_NAVIGATION` and `UTILITY_NAV` exports unchanged. Remove the local type definitions (lines 9-26).

**Step 2: Commit**

```bash
git add lib/constants/navigation.ts
git commit -m "refactor: use shared types in navigation constants"
```

---

### Task 16: Delete `lib/shopify/` Directory

**Files:**

- Delete: `lib/shopify/` (entire directory)

**Step 1: Verify no remaining imports from lib/shopify**

Run: `grep -r "from.*lib/shopify\|from.*\./shopify" --include="*.ts" --include="*.tsx" lib/ app/ components/`
Expected: No results

**Step 2: Delete the directory**

```bash
rm -rf lib/shopify
```

**Step 3: Commit**

```bash
git add -A lib/shopify
git commit -m "chore: remove Shopify integration (replaced by Medusa)"
```

---

### Task 17: Build Verification

**Step 1: Run TypeScript check**

Run: `pnpm exec tsc --noEmit --pretty`
Expected: No errors

If there are errors, fix them. Common issues:

- Missing `import type` annotations
- Property access on `HttpTypes.StoreProduct` that differs from expected shape
- The `"use cache"` directive may need `// @ts-expect-error` in some contexts

**Step 2: Run build**

Run: `pnpm build`

This will fail if env vars aren't set. Create a minimal `.env.local` for build testing:

```
MEDUSA_BACKEND_URL=http://localhost:9000
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_test
```

Run: `pnpm build`
Expected: Build completes. Pages may show data-fetch errors (no Medusa running) but the build itself should succeed.

**Step 3: Run formatter**

Run: `pnpm prettier`

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve build errors from Medusa integration"
```

---

### Task 18: Final Cleanup and Documentation

**Files:**

- Modify: `CLAUDE.md` — update references to Shopify with Medusa
- Modify: `README.md` — if it references Shopify setup

**Step 1: Update CLAUDE.md**

Key changes:

- Environment Setup section: replace Shopify env vars with Medusa vars
- Data Layer Architecture section: update to describe `lib/medusa/`
- Remove all Shopify-specific references (metaobjects, GraphQL, etc.)
- Update "Common Gotchas" section
- Update GraphQL Patterns section (now REST via SDK)

**Step 2: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: update project documentation for Medusa backend"
```

---

## Verification Checklist

After all tasks are complete, verify:

- [ ] `pnpm exec tsc --noEmit` passes with no errors
- [ ] `pnpm build` completes (with `.env.local` set)
- [ ] `pnpm prettier:check` passes
- [ ] No files import from `lib/shopify` or `lib/shopify/types`
- [ ] `lib/shopify/` directory is deleted
- [ ] `lib/medusa/index.ts` exports all required functions
- [ ] `lib/types.ts` contains all public types
- [ ] `lib/medusa/transforms.ts` handles product, collection, and cart transforms
- [ ] `.env.example` lists Medusa env vars
- [ ] `next.config.ts` has Medusa-compatible image patterns

## Integration Testing (requires running Medusa backend)

To fully test, you need a running Medusa v2 instance:

1. Start Medusa: `npx medusa develop` (in a separate project)
2. Seed data: `npx medusa seed`
3. Get publishable key from Medusa admin
4. Set env vars and run: `pnpm dev`
5. Verify: home page loads products, product detail pages work, cart add/remove works, search returns results, collections filter correctly
