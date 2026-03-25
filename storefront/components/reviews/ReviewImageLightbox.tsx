"use client";

import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react";
import {
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import Image from "next/image";
import { useState } from "react";

export function ReviewImageLightbox({
  images,
  initialIndex,
  open,
  onClose,
}: {
  images: { url: string }[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const image = images[index];

  if (!image) return null;

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-black/80" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          className="relative max-h-[90vh] max-w-3xl"
          data-testid="review-lightbox"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close image"
            data-testid="review-lightbox-close"
            className="absolute -top-10 right-0 text-white hover:text-gray-300"
          >
            <XMarkIcon className="size-8" />
          </button>

          <Image
            src={image.url}
            alt={`Review image ${index + 1} of ${images.length}`}
            width={800}
            height={600}
            data-testid="review-lightbox-image"
            className="max-h-[80vh] rounded-lg object-contain"
          />

          {images.length > 1 && (
            <div className="absolute inset-y-0 flex w-full items-center justify-between px-2">
              <button
                type="button"
                onClick={() =>
                  setIndex((i) => (i > 0 ? i - 1 : images.length - 1))
                }
                aria-label="Previous image"
                data-testid="review-lightbox-prev"
                className="rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
              >
                <ChevronLeftIcon className="size-6" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setIndex((i) => (i < images.length - 1 ? i + 1 : 0))
                }
                aria-label="Next image"
                data-testid="review-lightbox-next"
                className="rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
              >
                <ChevronRightIcon className="size-6" />
              </button>
            </div>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
