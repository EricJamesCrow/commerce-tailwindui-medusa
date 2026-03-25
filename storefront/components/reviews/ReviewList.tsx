import { StarIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";
import type { Review } from "lib/types";
import { DEFAULT_LOCALE } from "lib/constants";

export function ReviewList({
  reviews,
  onImageClick,
}: {
  reviews: Review[];
  onImageClick: (
    images: { url: string; id: string; sort_order: number }[],
    index: number,
  ) => void;
}) {

  if (reviews.length === 0) {
    return (
      <p className="text-sm text-gray-500" data-testid="review-empty-state">
        No reviews yet. Be the first to share your thoughts!
      </p>
    );
  }

  return (
    <>
      <div className="flow-root" data-testid="review-list">
        <div className="-my-12 divide-y divide-gray-200">
          {reviews.map((review) => {
            const sortedImages = [...(review.images || [])].sort(
              (a, b) => a.sort_order - b.sort_order
            );

            return (
              <div key={review.id} className="py-12" data-testid="review-item">
                <div className="flex items-center">
                  <div className="flex size-12 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-600">
                    {review.first_name.charAt(0)}
                    {review.last_name.charAt(0)}
                  </div>
                  <div className="ml-4">
                    <h4 className="text-sm font-bold text-gray-900" data-testid="review-author-name">
                      {review.first_name} {review.last_name.charAt(0)}.
                    </h4>
                    <div className="mt-1 flex items-center">
                      {[0, 1, 2, 3, 4].map((rating) => (
                        <StarIcon
                          key={rating}
                          aria-hidden="true"
                          className={clsx(
                            review.rating > rating
                              ? "text-yellow-400"
                              : "text-gray-300",
                            "size-5 shrink-0",
                          )}
                        />
                      ))}
                    </div>
                    <p className="sr-only">{review.rating} out of 5 stars</p>
                  </div>
                </div>

                {review.title && (
                  <h5 className="mt-4 text-sm font-semibold text-gray-900" data-testid="review-title-text">
                    {review.title}
                  </h5>
                )}

                <p className="mt-2 text-sm text-gray-600" data-testid="review-content-text">{review.content}</p>

                {/* Review Images */}
                {sortedImages.length > 0 && (
                  <div className="mt-3 flex gap-2">
                    {sortedImages.map((img, i) => (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => onImageClick(sortedImages, i)}
                        data-testid="review-image-thumbnail"
                        className="overflow-hidden rounded-md"
                      >
                        <img
                          src={img.url}
                          alt={`Review image ${i + 1}`}
                          className="size-16 rounded-md object-cover transition hover:opacity-75"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      </button>
                    ))}
                  </div>
                )}

                <time
                  dateTime={review.created_at}
                  className="mt-2 block text-xs text-gray-400"
                >
                  {new Date(review.created_at).toLocaleDateString(
                    DEFAULT_LOCALE,
                    {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    },
                  )}
                </time>

                {/* Admin Response */}
                {review.response && (
                  <div className="mt-4 rounded-lg bg-gray-50 p-4" data-testid="review-store-response">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Store response
                    </p>
                    <p className="mt-1 text-sm text-gray-700">
                      {review.response.content}
                    </p>
                    <time
                      dateTime={review.response.created_at}
                      className="mt-1 block text-xs text-gray-400"
                    >
                      {new Date(
                        review.response.created_at,
                      ).toLocaleDateString(DEFAULT_LOCALE, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </time>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </>
  );
}
