"use client";

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { XMarkIcon, StarIcon } from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolid } from "@heroicons/react/20/solid";
import clsx from "clsx";
import { useState, useRef, useEffect } from "react";
import type { Review } from "lib/types";

export function ReviewForm({
  productId,
  open,
  onClose,
  onSubmitted,
  customerName,
  serverError,
}: {
  productId: string;
  open: boolean;
  onClose: () => void;
  onSubmitted: (review: Review, formData: FormData) => void;
  customerName: { firstName: string; lastName: string } | null;
  serverError?: string | null;
}) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const blobUrls = useRef<Map<File, string>>(new Map())

  function getBlobUrl(file: File): string {
    if (!blobUrls.current.has(file)) {
      blobUrls.current.set(file, URL.createObjectURL(file))
    }
    return blobUrls.current.get(file)!
  }

  function revokeBlobUrl(file: File): void {
    const url = blobUrls.current.get(file)
    if (url) {
      URL.revokeObjectURL(url)
      blobUrls.current.delete(file)
    }
  }

  useEffect(() => {
    return () => {
      blobUrls.current.forEach((url) => URL.revokeObjectURL(url))
      blobUrls.current.clear()
    }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles((prev) => [...prev, ...files].slice(0, 3));
    e.target.value = ""; // reset input
  };

  const removeFile = (index: number) => {
    const file = selectedFiles[index]
    if (file) revokeBlobUrl(file)
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (formData: FormData) => {
    setError(null);
    setIsSubmitting(true);

    // Upload images first (if any)
    let uploadedImages: { url: string; sort_order: number }[] = [];
    if (selectedFiles.length > 0) {
      try {
        const uploadData = new FormData();
        for (const file of selectedFiles) uploadData.append("files", file);

        const res = await fetch("/api/reviews/upload", {
          method: "POST",
          body: uploadData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Upload failed");
        }

        const { files: uploaded } = await res.json();
        uploadedImages = uploaded.map(
          (f: { url: string }, i: number) => ({ url: f.url, sort_order: i }),
        );
        formData.set("images", JSON.stringify(uploadedImages));
      } catch {
        setIsSubmitting(false);
        setError("Failed to upload images. Please try again.");
        return;
      }
    }

    // Build optimistic Review object
    const title = (formData.get("title") as string)?.trim() || "";
    const content = (formData.get("content") as string)?.trim() || "";

    const optimisticReview: Review = {
      id: `optimistic_${Date.now()}`,
      title,
      content,
      rating,
      first_name: customerName?.firstName || "You",
      last_name: customerName?.lastName || "",
      created_at: new Date().toISOString(),
      images: uploadedImages.map((img, i) => ({
        id: `optimistic_img_${i}`,
        url: img.url,
        sort_order: img.sort_order,
      })),
      response: null,
    };

    setIsSubmitting(false);

    // Reset form state for next time
    setRating(0);
    blobUrls.current.forEach((url) => URL.revokeObjectURL(url))
    blobUrls.current.clear()
    setSelectedFiles([]);
    setError(null);

    // Hand off to parent — parent handles optimistic update + server action
    onSubmitted(optimisticReview, formData);
  };

  const displayRating = hoverRating || rating;
  const isDisabled = isSubmitting || rating === 0;

  function submitButtonLabel(): string {
    if (isSubmitting) return selectedFiles.length > 0 ? "Uploading images..." : "Submitting...";
    return "Submit review";
  }

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-gray-500/75 transition-opacity" />

      <div className="fixed inset-0 z-10 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <DialogPanel className="relative w-full max-w-lg rounded-lg bg-white px-6 py-8 shadow-xl">
            <div className="absolute top-4 right-4">
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">Close</span>
                <XMarkIcon className="size-6" aria-hidden="true" />
              </button>
            </div>

            <DialogTitle className="text-lg font-semibold text-gray-900">
              Write a review
            </DialogTitle>

            <form action={handleSubmit} className="mt-6 space-y-6" data-testid="review-form">
              <input type="hidden" name="product_id" value={productId} />
              <input type="hidden" name="rating" value={rating} />

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Rating
                </label>
                <div className="mt-2 flex gap-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-0.5"
                      data-testid={`review-star-${star}`}
                    >
                      {displayRating >= star ? (
                        <StarIconSolid className="size-8 text-yellow-400" />
                      ) : (
                        <StarIcon className="size-8 text-gray-300" />
                      )}
                      <span className="sr-only">
                        {star} star{star !== 1 ? "s" : ""}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="review-title"
                  className="block text-sm font-medium text-gray-700"
                >
                  Title <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  id="review-title"
                  name="title"
                  data-testid="review-title-input"
                  className="mt-2 block w-full rounded-md bg-white px-3 py-2 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 sm:text-sm/6"
                  placeholder="Summarize your experience"
                />
              </div>

              <div>
                <label
                  htmlFor="review-content"
                  className="block text-sm font-medium text-gray-700"
                >
                  Review
                </label>
                <textarea
                  id="review-content"
                  name="content"
                  rows={4}
                  required
                  data-testid="review-content-input"
                  className="mt-2 block w-full rounded-md bg-white px-3 py-2 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 sm:text-sm/6"
                  placeholder="What did you like or dislike about this product?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Photos <span className="text-gray-400">(optional, max 3)</span>
                </label>
                <div className="mt-2 flex gap-2">
                  {selectedFiles.map((file, i) => (
                    <div key={i} className="relative" data-testid="review-image-preview">
                      <img
                        src={getBlobUrl(file)}
                        alt=""
                        className="size-16 rounded-md object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        data-testid="review-image-remove"
                        className="absolute -top-1 -right-1 rounded-full bg-gray-900 p-0.5 text-white"
                      >
                        <XMarkIcon className="size-3" />
                      </button>
                    </div>
                  ))}
                  {selectedFiles.length < 3 && (
                    <label data-testid="review-add-photo-label" className="flex size-16 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-gray-300 hover:border-gray-400">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleFileChange}
                        data-testid="review-file-input"
                        className="hidden"
                      />
                      <span className="text-2xl text-gray-400">+</span>
                    </label>
                  )}
                </div>
              </div>

              {(error || serverError) && (
                <p className="text-sm text-red-600" data-testid="review-error-message">{error || serverError}</p>
              )}

              <button
                type="submit"
                disabled={isDisabled}
                data-testid="review-submit-button"
                className={clsx(
                  "w-full rounded-md px-4 py-2.5 text-sm font-semibold text-white shadow-sm",
                  isDisabled
                    ? "cursor-not-allowed bg-gray-300"
                    : "bg-primary-600 hover:bg-primary-500 focus-visible:outline-primary-600 focus-visible:outline-2 focus-visible:outline-offset-2",
                )}
              >
                {submitButtonLabel()}
              </button>
            </form>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
