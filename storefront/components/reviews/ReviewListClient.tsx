"use client";

import { useState } from "react";
import { ReviewList } from "./ReviewList";
import { ReviewImageLightbox } from "./ReviewImageLightbox";
import type { Review } from "lib/types";

type LightboxState = {
  images: { url: string; id: string; sort_order: number }[];
  index: number;
} | null;

export function ReviewListClient({ reviews }: { reviews: Review[] }) {
  const [lightbox, setLightbox] = useState<LightboxState>(null);

  return (
    <>
      <ReviewList
        reviews={reviews}
        onImageClick={(images, index) => setLightbox({ images, index })}
      />
      {lightbox && (
        <ReviewImageLightbox
          images={lightbox.images}
          initialIndex={lightbox.index}
          open={true}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );
}
