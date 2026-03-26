import type { HttpTypes } from "@medusajs/types";
import { describe, expect, it } from "vitest";
import {
  transformCart,
  transformCollection,
  transformProduct,
} from "lib/medusa/transforms";

type DeepPartial<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends (infer U)[]
    ? DeepPartial<U>[]
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> }
      : T;

function makeVariant(
  overrides: DeepPartial<HttpTypes.StoreProductVariant> = {},
): HttpTypes.StoreProductVariant {
  return {
    id: "variant_default",
    title: "Default Variant",
    sku: "SKU-DEFAULT",
    manage_inventory: true,
    options: [
      {
        value: "M",
        option: {
          title: "Size",
        },
      },
    ],
    calculated_price: {
      currency_code: "usd",
      calculated_amount: 48,
    },
    inventory_quantity: 5,
    ...overrides,
  } as unknown as HttpTypes.StoreProductVariant;
}

function makeProduct(
  overrides: DeepPartial<HttpTypes.StoreProduct> = {},
): HttpTypes.StoreProduct {
  return {
    id: "prod_123",
    handle: "linen-shirt",
    title: "Linen Shirt",
    description: "A lightweight shirt.",
    thumbnail: "https://cdn.example.com/thumbnail.jpg",
    options: [
      {
        id: "option_size",
        title: "Size",
        values: [{ value: "S" }, { value: "M" }],
      },
    ],
    images: [
      {
        url: "https://cdn.example.com/gallery-1.jpg",
      },
    ],
    variants: [makeVariant()],
    metadata: {
      seo_title: "SEO Linen Shirt",
      seo_description: "SEO description",
    },
    tags: [{ value: "summer" }, { name: "linen" }, "sale"],
    updated_at: "2026-03-25T12:00:00.000Z",
    ...overrides,
  } as unknown as HttpTypes.StoreProduct;
}

function makeCollection(
  overrides: DeepPartial<HttpTypes.StoreCollection> = {},
): HttpTypes.StoreCollection {
  return {
    handle: "shirts",
    title: "Shirts",
    metadata: {
      description: "Collection description",
      seo_title: "SEO Shirts",
      seo_description: "SEO collection description",
      image_url: "https://cdn.example.com/collection.jpg",
    },
    updated_at: "2026-03-25T12:00:00.000Z",
    ...overrides,
  } as unknown as HttpTypes.StoreCollection;
}

function makeCart(
  overrides: DeepPartial<HttpTypes.StoreCart> = {},
): HttpTypes.StoreCart {
  return {
    id: "cart_123",
    currency_code: "usd",
    item_subtotal: 96,
    total: 108,
    tax_total: 12,
    items: [],
    ...overrides,
  } as unknown as HttpTypes.StoreCart;
}

describe("transformProduct", () => {
  it("maps populated Medusa products into storefront products", () => {
    const product = transformProduct(
      makeProduct({
        variants: [
          makeVariant({
            id: "variant_out_of_stock",
            title: "Small",
            sku: "SKU-S",
            manage_inventory: true,
            inventory_quantity: 0,
            calculated_price: {
              currency_code: "usd",
              calculated_amount: 48,
            },
          }),
          makeVariant({
            id: "variant_backorderable",
            title: "Large",
            sku: "SKU-L",
            manage_inventory: false,
            inventory_quantity: 0,
            options: [
              {
                value: "L",
                option: {
                  title: "Size",
                },
              },
              {
                value: "Blue",
                option: {
                  title: "Color",
                },
              },
            ],
            calculated_price: {
              currency_code: "usd",
              calculated_amount: 64,
            },
          }),
        ],
      }),
    );

    expect(product.availableForSale).toBe(true);
    expect(product.priceRange).toEqual({
      minVariantPrice: { amount: "48.00", currencyCode: "USD" },
      maxVariantPrice: { amount: "64.00", currencyCode: "USD" },
    });
    expect(product.featuredImage).toEqual({
      url: "https://cdn.example.com/thumbnail.jpg",
      altText: "Linen Shirt",
      width: 0,
      height: 0,
    });
    expect(product.options).toEqual([
      {
        id: "option_size",
        name: "Size",
        values: ["S", "M"],
      },
    ]);
    expect(product.variants).toEqual([
      {
        id: "variant_out_of_stock",
        title: "Small",
        availableForSale: false,
        sku: "SKU-S",
        selectedOptions: [{ name: "Size", value: "M" }],
        price: { amount: "48.00", currencyCode: "USD" },
      },
      {
        id: "variant_backorderable",
        title: "Large",
        availableForSale: true,
        sku: "SKU-L",
        selectedOptions: [
          { name: "Size", value: "L" },
          { name: "Color", value: "Blue" },
        ],
        price: { amount: "64.00", currencyCode: "USD" },
      },
    ]);
    expect(product.seo).toEqual({
      title: "SEO Linen Shirt",
      description: "SEO description",
    });
    expect(product.tags).toEqual(["summer", "linen", "sale"]);
  });

  it("falls back to the first image and current defaults when product fields are sparse", () => {
    const product = transformProduct(
      makeProduct({
        title: undefined,
        description: undefined,
        thumbnail: undefined,
        images: [{ url: "https://cdn.example.com/fallback.jpg" }],
        metadata: {},
        tags: [],
      }),
    );

    expect(product.title).toBe("");
    expect(product.description).toBe("");
    expect(product.descriptionHtml).toBe("");
    expect(product.featuredImage).toEqual({
      url: "https://cdn.example.com/fallback.jpg",
      altText: "",
      width: 0,
      height: 0,
    });
    expect(product.images).toEqual([
      {
        url: "https://cdn.example.com/fallback.jpg",
        altText: "",
        width: 0,
        height: 0,
      },
    ]);
    expect(product.seo).toEqual({
      title: "",
      description: "",
    });
  });

  it("returns an empty featured image object when there is no thumbnail or gallery image", () => {
    const product = transformProduct(
      makeProduct({
        title: undefined,
        thumbnail: undefined,
        images: [],
      }),
    );

    expect(product.featuredImage).toEqual({
      url: "",
      altText: "",
      width: 0,
      height: 0,
    });
  });
});

describe("transformCollection", () => {
  it("maps metadata-driven collection content and image fields", () => {
    const collection = transformCollection(makeCollection());

    expect(collection).toEqual({
      handle: "shirts",
      title: "Shirts",
      description: "Collection description",
      seo: {
        title: "SEO Shirts",
        description: "SEO collection description",
      },
      updatedAt: "2026-03-25T12:00:00.000Z",
      path: "/products/shirts",
      image: {
        url: "https://cdn.example.com/collection.jpg",
        altText: "Shirts",
        width: 0,
        height: 0,
      },
    });
  });

  it("preserves current empty-handle and empty-metadata fallbacks", () => {
    const collection = transformCollection(
      makeCollection({
        handle: "",
        title: "Sale",
        metadata: {},
      }),
    );

    expect(collection).toEqual({
      handle: "",
      title: "Sale",
      description: "",
      seo: {
        title: "Sale",
        description: "",
      },
      updatedAt: "2026-03-25T12:00:00.000Z",
      path: "/products/",
      image: undefined,
    });
  });
});

describe("transformCart", () => {
  it("maps totals, options, thumbnail fallbacks, and total quantity", () => {
    const cart = transformCart(
      makeCart({
        items: [
          {
            id: "line_1",
            quantity: 2,
            total: 96,
            title: "Linen Shirt",
            variant_id: "variant_1",
            product_id: "prod_123",
            thumbnail: undefined,
            product: {
              id: "prod_123",
              handle: "linen-shirt",
              title: "Linen Shirt",
              thumbnail: "https://cdn.example.com/product-thumb.jpg",
            },
            variant: {
              id: "variant_1",
              title: "Large",
              options: [
                {
                  value: "Large",
                  option: {
                    title: "Size",
                  },
                },
              ],
            },
          },
          {
            id: "line_2",
            quantity: 1,
            total: 12,
            title: "Gift Wrap",
            variant_id: "variant_2",
            product_id: "prod_456",
            thumbnail: "https://cdn.example.com/line-thumb.jpg",
            product: {
              id: "prod_456",
              handle: "gift-wrap",
              title: "Gift Wrap",
              thumbnail: "https://cdn.example.com/ignored-product-thumb.jpg",
            },
            variant: {
              id: "variant_2",
              title: "Default",
              options: [],
            },
          },
        ],
      }),
    );

    expect(cart.cost).toEqual({
      subtotalAmount: { amount: "96.00", currencyCode: "USD" },
      totalAmount: { amount: "108.00", currencyCode: "USD" },
      totalTaxAmount: { amount: "12.00", currencyCode: "USD" },
    });
    expect(cart.totalQuantity).toBe(3);
    expect(cart.lines).toEqual([
      {
        id: "line_1",
        quantity: 2,
        cost: {
          totalAmount: { amount: "96.00", currencyCode: "USD" },
        },
        merchandise: {
          id: "variant_1",
          title: "Large",
          selectedOptions: [{ name: "Size", value: "Large" }],
          product: {
            id: "prod_123",
            handle: "linen-shirt",
            title: "Linen Shirt",
            featuredImage: {
              url: "https://cdn.example.com/product-thumb.jpg",
              altText: "Linen Shirt",
              width: 0,
              height: 0,
            },
          },
        },
      },
      {
        id: "line_2",
        quantity: 1,
        cost: {
          totalAmount: { amount: "12.00", currencyCode: "USD" },
        },
        merchandise: {
          id: "variant_2",
          title: "Default",
          selectedOptions: [],
          product: {
            id: "prod_456",
            handle: "gift-wrap",
            title: "Gift Wrap",
            featuredImage: {
              url: "https://cdn.example.com/line-thumb.jpg",
              altText: "Gift Wrap",
              width: 0,
              height: 0,
            },
          },
        },
      },
    ]);
  });

  it("returns current empty-string fallbacks for partial line item data", () => {
    const cart = transformCart(
      makeCart({
        items: [
          {
            id: "line_partial",
            quantity: 1,
            total: 5,
            title: "Fallback title",
            variant_id: "variant_partial",
            product_id: "prod_partial",
            product: {},
            variant: {},
          },
        ],
      }),
    );

    expect(cart.lines).toEqual([
      {
        id: "line_partial",
        quantity: 1,
        cost: {
          totalAmount: { amount: "5.00", currencyCode: "USD" },
        },
        merchandise: {
          id: "variant_partial",
          title: "Fallback title",
          selectedOptions: [],
          product: {
            id: "prod_partial",
            handle: "",
            title: "Fallback title",
            featuredImage: {
              url: "",
              altText: "Fallback title",
              width: 0,
              height: 0,
            },
          },
        },
      },
    ]);
  });
});
