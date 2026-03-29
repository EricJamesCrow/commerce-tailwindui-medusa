"use server";

import { sdk } from "lib/medusa";
import { TAGS } from "lib/constants";
import type { ProductReviews, Review } from "lib/types";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { getAuthHeaders } from "lib/medusa/cookies";
import { retrieveCustomer } from "lib/medusa/customer";
import { trackServer } from "lib/analytics-server";
import * as Sentry from "@sentry/nextjs";

export type ReviewActionResult = { error?: string; success?: boolean } | null;

type ReviewImageInput = { url: string; sort_order: number };
const REVIEWS_REVALIDATE_SECONDS = 60 * 60 * 24;

function parseImagesField(json: string | null): ReviewImageInput[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function createEmptyProductReviews(): ProductReviews {
  return {
    reviews: [],
    averageRating: 0,
    count: 0,
    ratingDistribution: [5, 4, 3, 2, 1].map((rating) => ({ rating, count: 0 })),
  };
}

// Parameterized review loaders use unstable_cache because Next 16 prerendering
// has timed out on this route when "use cache" is used directly.
const getProductReviewsCached = unstable_cache(
  async (
    productId: string,
    limit: number,
    offset: number,
  ): Promise<ProductReviews> => {
    let response;
    try {
      response = await sdk.client.fetch<{
        reviews: Review[];
        average_rating: number;
        count: number;
        limit: number;
        offset: number;
        rating_distribution: { rating: number; count: number }[];
      }>(`/store/products/${productId}/reviews`, {
        method: "GET",
        query: {
          limit,
          offset,
          order: "-created_at",
        },
        cache: "force-cache",
        next: { tags: [TAGS.reviews] },
      });
    } catch (error) {
      Sentry.captureException(error, {
        tags: { action: "get_product_reviews", product_id: productId },
        level: "warning",
      });
      console.error("[reviews] Failed to fetch product reviews:", error);
      return createEmptyProductReviews();
    }

    // Build full 1-5 distribution (fill missing ratings with 0)
    const distributionMap = new Map(
      response.rating_distribution.map((d) => [d.rating, d.count]),
    );
    const ratingDistribution = [5, 4, 3, 2, 1].map((rating) => ({
      rating,
      count: distributionMap.get(rating) ?? 0,
    }));

    return {
      reviews: response.reviews,
      averageRating: response.average_rating,
      count: response.count,
      ratingDistribution,
    };
  },
  ["medusa-product-reviews"],
  {
    tags: [TAGS.reviews],
    revalidate: REVIEWS_REVALIDATE_SECONDS,
  },
);

export async function getProductReviews(
  productId: string,
  { limit = 10, offset = 0 }: { limit?: number; offset?: number } = {},
): Promise<ProductReviews> {
  return getProductReviewsCached(productId, limit, offset);
}

export async function getReviewerName(): Promise<{
  firstName: string;
  lastName: string;
} | null> {
  const customer = await retrieveCustomer();
  if (!customer) return null;
  return {
    firstName: customer.first_name || "Customer",
    lastName: customer.last_name || "",
  };
}

export async function addProductReview(
  prevState: ReviewActionResult,
  formData: FormData,
): Promise<ReviewActionResult> {
  const productId = formData.get("product_id") as string;
  const title = (formData.get("title") as string)?.trim() || undefined;
  const content = (formData.get("content") as string)?.trim();
  const rating = Number(formData.get("rating"));

  // Parse image URLs from hidden form field (JSON-encoded array)
  const images = parseImagesField(formData.get("images") as string | null);

  if (!content) return { error: "Review content is required" };
  if (!rating || rating < 1 || rating > 5)
    return { error: "Please select a rating" };

  const customer = await retrieveCustomer();
  if (!customer) return { error: "You must be logged in to leave a review" };

  const headers = await getAuthHeaders();

  try {
    await sdk.client.fetch("/store/reviews", {
      method: "POST",
      headers,
      body: {
        product_id: productId,
        title,
        content,
        rating,
        first_name: customer.first_name || "Customer",
        last_name: customer.last_name || "",
        ...(images.length > 0 && { images }),
      },
    });
    try {
      await trackServer("review_submitted", {
        product_id: productId,
        rating,
        has_images: images.length > 0,
      });
    } catch {}
  } catch (e) {
    Sentry.captureException(e, {
      tags: { action: "add_product_review" },
      level: "warning",
    });
    return {
      error: e instanceof Error ? e.message : "Error submitting review",
    };
  } finally {
    revalidateTag(TAGS.reviews, "max");
    revalidatePath("/", "layout");
  }

  return { success: true };
}
