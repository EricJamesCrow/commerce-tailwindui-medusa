import { describe, expect, it } from "vitest";
import { safeJsonLd } from "lib/json-ld";
import {
  buildBreadcrumbJsonLd,
  buildItemListJsonLd,
  buildOrganizationJsonLd,
  buildProductJsonLd,
} from "lib/structured-data";
import type { Product, ProductReviews } from "lib/types";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "prod_123",
    handle: "linen-shirt",
    availableForSale: true,
    title: "Linen Shirt",
    description: "A lightweight shirt.",
    descriptionHtml: "<p>A lightweight shirt.</p>",
    options: [],
    priceRange: {
      minVariantPrice: { amount: "48.00", currencyCode: "USD" },
      maxVariantPrice: { amount: "64.00", currencyCode: "USD" },
    },
    variants: [
      {
        id: "variant_1",
        title: "Small",
        availableForSale: true,
        sku: "LS-SM",
        selectedOptions: [],
        price: { amount: "48.00", currencyCode: "USD" },
      },
      {
        id: "variant_2",
        title: "Large",
        availableForSale: true,
        selectedOptions: [],
        price: { amount: "64.00", currencyCode: "USD" },
      },
    ],
    featuredImage: {
      url: "/images/linen-shirt.jpg",
      altText: "Linen Shirt",
      width: 1200,
      height: 1200,
    },
    images: [
      {
        url: "/images/linen-shirt.jpg",
        altText: "Linen Shirt",
        width: 1200,
        height: 1200,
      },
    ],
    seo: {
      title: "Linen Shirt",
      description: "A lightweight shirt.",
    },
    tags: [],
    updatedAt: "2026-03-24T00:00:00.000Z",
    ...overrides,
  };
}

function makeReviews(overrides: Partial<ProductReviews> = {}): ProductReviews {
  return {
    reviews: [
      {
        id: "review_1",
        title: "Excellent fit",
        content: "Very comfortable and breathable.",
        rating: 5,
        first_name: "Alex",
        last_name: "Rivera",
        created_at: "2026-03-20T00:00:00.000Z",
        images: [],
        response: null,
      },
    ],
    averageRating: 5,
    count: 1,
    ratingDistribution: [
      { rating: 5, count: 1 },
      { rating: 4, count: 0 },
      { rating: 3, count: 0 },
      { rating: 2, count: 0 },
      { rating: 1, count: 0 },
    ],
    ...overrides,
  };
}

describe("structured data builders", () => {
  it("emits product schema without reviews when none exist", () => {
    const productJsonLd = buildProductJsonLd(makeProduct(), null);

    expect(productJsonLd["@type"]).toBe("Product");
    expect(productJsonLd.offers).toMatchObject({
      "@type": "AggregateOffer",
      lowPrice: "48.00",
      highPrice: "64.00",
      priceCurrency: "USD",
      offerCount: 2,
    });
    expect(productJsonLd.offers).not.toHaveProperty("priceValidUntil");
    expect(productJsonLd.aggregateRating).toBeUndefined();
    expect(productJsonLd.review).toBeUndefined();
    expect(productJsonLd.sku).toBe("LS-SM");
  });

  it("falls back to the featured image when no gallery images exist", () => {
    const productJsonLd = buildProductJsonLd(
      makeProduct({
        images: [],
        featuredImage: {
          url: "/images/featured-only.jpg",
          altText: "Featured only",
          width: 1200,
          height: 1200,
        },
      }),
      null,
    );

    expect(productJsonLd.image).toEqual([
      "http://localhost:3000/images/featured-only.jpg",
    ]);
  });

  it("emits aggregate rating and review entries when reviews exist", () => {
    const productJsonLd = buildProductJsonLd(makeProduct(), makeReviews());

    expect(productJsonLd.aggregateRating).toMatchObject({
      "@type": "AggregateRating",
      ratingValue: "5.0",
      reviewCount: 1,
      bestRating: 5,
      worstRating: 1,
    });
    expect(productJsonLd.review).toMatchObject([
      {
        "@type": "Review",
        headline: "Excellent fit",
        reviewBody: "Very comfortable and breathable.",
      },
    ]);
  });

  it("maps unavailable products to OutOfStock", () => {
    const productJsonLd = buildProductJsonLd(
      makeProduct({ availableForSale: false }),
      null,
    );

    expect(productJsonLd.offers).toMatchObject({
      availability: "https://schema.org/OutOfStock",
    });
  });

  it("builds breadcrumb lists with ascending positions", () => {
    const breadcrumbs = buildBreadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Products", path: "/products" },
      { name: "Linen Shirt", path: "/product/linen-shirt" },
    ]);

    expect(breadcrumbs.itemListElement).toMatchObject([
      { position: 1, name: "Home" },
      { position: 2, name: "Products" },
      { position: 3, name: "Linen Shirt" },
    ]);
  });

  it("builds item lists with product names and images", () => {
    const itemList = buildItemListJsonLd([
      {
        position: 1,
        name: "Linen Shirt",
        path: "/product/linen-shirt",
        image: "/images/linen-shirt.jpg",
      },
    ]);

    expect(itemList.itemListElement).toMatchObject([
      {
        "@type": "ListItem",
        position: 1,
        item: {
          "@type": "Thing",
          name: "Linen Shirt",
        },
      },
    ]);
  });

  it("omits optional organization fields when unset", () => {
    const organization = buildOrganizationJsonLd({
      name: "Example Store",
      url: "https://store.example.com",
    });
    const organizationObject = organization as Exclude<
      typeof organization,
      string
    >;

    expect(organizationObject).toMatchObject({
      "@type": "Organization",
      name: "Example Store",
      url: "https://store.example.com",
    });
    expect(organizationObject.logo).toBeUndefined();
    expect(organizationObject.contactPoint).toBeUndefined();
    expect(organizationObject.sameAs).toBeUndefined();
  });
});

describe("safeJsonLd", () => {
  it("escapes closing script tags", () => {
    expect(safeJsonLd({ html: "</script>" })).toContain("<\\/script>");
  });
});
