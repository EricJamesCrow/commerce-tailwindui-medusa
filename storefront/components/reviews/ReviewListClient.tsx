"use client";

import { ReviewList } from "./ReviewList";
import type { Review } from "lib/types";

export function ReviewListClient({ reviews }: { reviews: Review[] }) {
  return <ReviewList reviews={reviews} />;
}
