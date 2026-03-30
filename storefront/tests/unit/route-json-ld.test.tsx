import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const medusaMocks = vi.hoisted(() => ({
  getProduct: vi.fn(),
  getProducts: vi.fn(),
  getProductRecommendations: vi.fn(),
  getCollections: vi.fn(),
  getCollection: vi.fn(),
  getCollectionProducts: vi.fn(),
}));

const reviewMocks = vi.hoisted(() => ({
  getProductReviews: vi.fn(),
}));

vi.mock("lib/medusa", () => medusaMocks);
vi.mock("lib/medusa/reviews", () => reviewMocks);
vi.mock("components/layout/product-grid", () => ({
  default: () => React.createElement("div", { "data-testid": "product-grid" }),
}));
vi.mock("components/product/product-page-content", () => ({
  ProductPageContent: () =>
    React.createElement("div", { "data-testid": "product-page-content" }),
}));
vi.mock("components/reviews/ProductReviewsSection", () => ({
  ProductReviewsSection: () =>
    React.createElement("div", { "data-testid": "reviews-section" }),
}));
vi.mock("components/product/related-products", () => ({
  RelatedProducts: () =>
    React.createElement("div", { "data-testid": "related-products" }),
}));
vi.mock("components/home/hero", () => ({
  Hero: () => React.createElement("div", { "data-testid": "hero" }),
}));
vi.mock("components/home/trending-products", () => ({
  TrendingProducts: () =>
    React.createElement("div", { "data-testid": "trending-products" }),
}));
vi.mock("components/home/collections", () => ({
  Collections: () =>
    React.createElement("div", { "data-testid": "collections" }),
}));

import HomePage from "app/page";
import ProductPage, {
  generateMetadata as generateProductMetadata,
} from "app/product/[handle]/page";
import ProductsCollectionPage from "app/(store)/products/[collection]/page";
import ProductsPage from "app/(store)/products/page";

const product = {
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
};

const reviews = {
  reviews: [
    {
      id: "review_1",
      title: "Excellent fit",
      content: "Very comfortable and breathable.",
      rating: 5,
      first_name: "Alex",
      last_name: "Rivera",
      created_at: "2026-03-20T00:00:00.000Z",
      verified_purchase: false,
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
};

beforeEach(() => {
  vi.clearAllMocks();
  medusaMocks.getProduct.mockResolvedValue(product);
  medusaMocks.getProducts.mockResolvedValue([product]);
  medusaMocks.getProductRecommendations.mockResolvedValue([]);
  medusaMocks.getCollections.mockResolvedValue([
    {
      handle: "shirts",
      title: "Shirts",
      description: "Shirts collection",
      seo: { title: "Shirts", description: "Shirts collection" },
      updatedAt: "2026-03-24T00:00:00.000Z",
      path: "/products/shirts",
      image: undefined,
    },
  ]);
  medusaMocks.getCollection.mockResolvedValue({
    handle: "shirts",
    title: "Shirts",
    description: "Shirts collection",
    seo: { title: "Shirts", description: "Shirts collection" },
    updatedAt: "2026-03-24T00:00:00.000Z",
    path: "/products/shirts",
    image: undefined,
  });
  medusaMocks.getCollectionProducts.mockResolvedValue([product]);
  reviewMocks.getProductReviews.mockResolvedValue(reviews);
});

describe("route JSON-LD output", () => {
  it("renders organization schema on the homepage", async () => {
    const html = renderToStaticMarkup(await HomePage());

    expect(html).toContain('"@type":"Organization"');
  });

  it("renders product and breadcrumb schema on the PDP", async () => {
    const html = renderToStaticMarkup(
      await ProductPage({ params: Promise.resolve({ handle: "linen-shirt" }) }),
    );

    expect(html).toContain('"@type":"Product"');
    expect(html).toContain('"@type":"BreadcrumbList"');
  });

  it("renders item list schema on the products page", async () => {
    const html = renderToStaticMarkup(
      await ProductsPage({ searchParams: Promise.resolve({}) }),
    );

    expect(html).toContain('"@type":"ItemList"');
    expect(html).toContain('"name":"Linen Shirt"');
  });

  it("renders breadcrumb and item list schema on collection pages", async () => {
    const html = renderToStaticMarkup(
      await ProductsCollectionPage({
        params: Promise.resolve({ collection: "shirts" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).toContain('"@type":"ItemList"');
  });
});

describe("product metadata", () => {
  it("sets a canonical URL on product pages", async () => {
    const metadata = await generateProductMetadata({
      params: Promise.resolve({ handle: "linen-shirt" }),
    });

    expect(metadata.alternates?.canonical).toBe("/product/linen-shirt");
  });
});
