"use client";

import { useEffect, useState, useTransition } from "react";
import { ReviewSummary } from "components/reviews/ReviewSummary";
import { ReviewList } from "components/reviews/ReviewList";
import { ReviewForm } from "components/reviews/ReviewForm";
import { trackClient } from "lib/analytics";
import type { ProductReviews as ProductReviewsType, Review } from "lib/types";
import {
  addProductReview,
  getProductReviews,
  getReviewerName,
} from "lib/medusa/reviews";

export function ProductReviews({
  productId,
  initialData,
  canReview,
}: {
  productId: string;
  initialData: ProductReviewsType;
  canReview: boolean;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Review[]>(initialData.reviews);
  const [summaryData, setSummaryData] = useState(initialData);
  const [customerName, setCustomerName] = useState<{
    firstName: string;
    lastName: string;
  } | null>(null);
  const [hasMore, setHasMore] = useState(
    initialData.count > initialData.reviews.length,
  );
  const [isLoadingMore, startLoadMore] = useTransition();

  // Fetch customer name on mount (outside "use cache" scope)
  useEffect(() => {
    getReviewerName().then(setCustomerName);
  }, []);

  function loadMore() {
    startLoadMore(async () => {
      const data = await getProductReviews(productId, {
        limit: 10,
        offset: reviews.length,
      });
      setReviews((prev) => [...prev, ...data.reviews]);
      setHasMore(data.count > reviews.length + data.reviews.length);
    });
  }

  function updateSummary(rating: number, delta: 1 | -1) {
    setSummaryData((prev) => {
      const newCount = prev.count + delta;
      const newAvg =
        newCount > 0
          ? (prev.averageRating * prev.count + rating * delta) / newCount
          : 0;
      const newDist = prev.ratingDistribution.map((d) =>
        d.rating === rating ? { ...d, count: d.count + delta } : d,
      );
      return {
        ...prev,
        count: newCount,
        averageRating: newAvg,
        ratingDistribution: newDist,
      };
    });
  }

  function handleReviewSubmitted(review: Review, formData: FormData) {
    setFormOpen(false);
    setFormError(null);

    // Optimistic: update state immediately
    setReviews((prev) => [review, ...prev]);
    updateSummary(review.rating, 1);

    // Fire server action in background
    addProductReview(null, formData).then((result) => {
      if (result?.error) {
        // Revert optimistic update
        setReviews((prev) => prev.filter((r) => r.id !== review.id));
        updateSummary(review.rating, -1);
        setFormError(result.error);
        setFormOpen(true);
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24 lg:grid lg:max-w-7xl lg:grid-cols-12 lg:gap-x-8 lg:px-8 lg:py-32">
      <div className="lg:col-span-4 lg:sticky lg:top-8 lg:self-start">
        <ReviewSummary
          reviews={summaryData}
          canReview={canReview}
          onWriteReview={() => {
            setFormOpen(true);
            trackClient("review_form_opened", { product_id: productId });
          }}
        />
      </div>

      <div className="mt-16 lg:col-span-7 lg:col-start-6 lg:mt-0">
        <h3 className="sr-only">Recent reviews</h3>
        <ReviewList reviews={reviews} />

        {hasMore && (
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={loadMore}
              disabled={isLoadingMore}
              className="rounded-md border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
            >
              {isLoadingMore ? "Loading..." : "Load more reviews"}
            </button>
          </div>
        )}
      </div>

      {canReview && (
        <ReviewForm
          productId={productId}
          open={formOpen}
          onClose={() => {
            setFormOpen(false);
            setFormError(null);
          }}
          onSubmitted={handleReviewSubmitted}
          customerName={customerName}
          serverError={formError}
        />
      )}
    </div>
  );
}
