import { StarIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";
import type { ProductReviews } from "lib/types";

export function ReviewSummary({
  reviews,
  onWriteReview,
  canReview,
}: {
  reviews: ProductReviews;
  onWriteReview?: () => void;
  canReview: boolean;
}) {
  const totalRatings = reviews.ratingDistribution.reduce(
    (sum, d) => sum + d.count,
    0,
  );

  // Largest-remainder method: percentages always sum to exactly 100
  const percentages = (() => {
    if (totalRatings === 0)
      return Object.fromEntries(
        reviews.ratingDistribution.map((d) => [d.rating, 0]),
      );
    const raw = reviews.ratingDistribution.map((d) => ({
      rating: d.rating,
      exact: (d.count / totalRatings) * 100,
      floored: Math.floor((d.count / totalRatings) * 100),
    }));
    let remainder = 100 - raw.reduce((s, r) => s + r.floored, 0);
    const sorted = [...raw].sort(
      (a, b) => b.exact - b.floored - (a.exact - a.floored),
    );
    const result: Record<number, number> = {};
    for (const r of sorted) {
      result[r.rating] = r.floored + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;
    }
    return result;
  })();

  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight text-gray-900">
        Customer Reviews
      </h2>

      <div className="mt-3 flex items-center">
        <div>
          <div className="flex items-center">
            {[0, 1, 2, 3, 4].map((rating) => (
              <StarIcon
                key={rating}
                aria-hidden="true"
                className={clsx(
                  reviews.averageRating > rating
                    ? "text-yellow-400"
                    : "text-gray-300",
                  "size-5 shrink-0",
                )}
              />
            ))}
          </div>
          <p className="sr-only">{reviews.averageRating} out of 5 stars</p>
        </div>
        <p className="ml-2 text-sm text-gray-900">
          Based on {reviews.count} review{reviews.count !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="mt-6">
        <h3 className="sr-only">Review data</h3>

        <dl className="space-y-3">
          {reviews.ratingDistribution.map((item) => (
            <div key={item.rating} className="flex items-center text-sm">
              <dt className="flex flex-1 items-center">
                <p className="w-3 font-medium text-gray-900">
                  {item.rating}
                  <span className="sr-only"> star reviews</span>
                </p>
                <div
                  aria-hidden="true"
                  className="ml-1 flex flex-1 items-center"
                >
                  <StarIcon
                    aria-hidden="true"
                    className={clsx(
                      item.count > 0 ? "text-yellow-400" : "text-gray-300",
                      "size-5 shrink-0",
                    )}
                  />

                  <div className="relative ml-3 flex-1">
                    <div className="h-3 rounded-full border border-gray-200 bg-gray-100" />
                    {item.count > 0 && totalRatings > 0 ? (
                      <div
                        style={{
                          width: `calc(${item.count} / ${totalRatings} * 100%)`,
                        }}
                        className="absolute inset-y-0 rounded-full border border-yellow-400 bg-yellow-400"
                      />
                    ) : null}
                  </div>
                </div>
              </dt>
              <dd className="ml-3 w-10 text-right text-sm text-gray-900 tabular-nums">
                {percentages[item.rating]}%
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {canReview && (
        <div className="mt-10">
          <h3 className="text-lg font-medium text-gray-900">
            Share your thoughts
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            If you&apos;ve used this product, share your thoughts with other
            customers
          </p>

          <button
            type="button"
            onClick={onWriteReview}
            className="mt-6 inline-flex w-full cursor-pointer items-center justify-center rounded-md border border-gray-300 bg-white px-8 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 sm:w-auto lg:w-full"
          >
            Write a review
          </button>
        </div>
      )}
    </div>
  );
}
