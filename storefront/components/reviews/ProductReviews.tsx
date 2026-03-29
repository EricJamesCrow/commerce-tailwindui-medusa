"use client";

import { useState, useTransition } from "react";
import { ReviewSummary } from "components/reviews/ReviewSummary";
import { ReviewListClient } from "components/reviews/ReviewListClient";
import { ReviewForm } from "components/reviews/ReviewForm";
import { trackClient } from "lib/analytics";
import type { ProductReviews as ProductReviewsType, Review } from "lib/types";
import { addProductReview, getProductReviews } from "lib/medusa/reviews";

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
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Review[]>(initialData.reviews);
  const [summaryData, setSummaryData] = useState(initialData);
  const [hasMore, setHasMore] = useState(
    initialData.count > initialData.reviews.length,
  );
  const [isLoadingMore, startLoadMore] = useTransition();

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

  function handleReviewSubmitted(formData: FormData) {
    setFormOpen(false);
    setFormError(null);
    setFormMessage(null);

    addProductReview(null, formData).then((result) => {
      if (result?.error) {
        setFormError(result.error);
        setFormOpen(true);
        return;
      }

      setFormMessage(
        "Thanks for your review. It has been submitted for moderation and will appear once approved.",
      );
    });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24 lg:grid lg:max-w-7xl lg:grid-cols-12 lg:gap-x-8 lg:px-8 lg:py-32">
      <div className="lg:sticky lg:top-8 lg:col-span-4 lg:self-start">
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
        {formMessage && (
          <p className="mb-6 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {formMessage}
          </p>
        )}
        <ReviewListClient reviews={reviews} />

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
          serverError={formError}
        />
      )}
    </div>
  );
}
