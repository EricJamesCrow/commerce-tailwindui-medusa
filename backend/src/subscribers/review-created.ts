import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework";
import { trackReviewCreatedWorkflow } from "../workflows/analytics/track-review-created";

export default async function reviewCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string; product_id: string }>) {
  const logger = container.resolve("logger");

  logger.info(
    `[ProductReview] Review created — review ${data.id} for product ${data.product_id}`,
  );

  try {
    await trackReviewCreatedWorkflow(container).run({
      input: { review_id: data.id, product_id: data.product_id },
    });
  } catch (error) {
    logger.warn(
      `[analytics] Failed to track review_created for ${data.id}: ${error}`,
    );
  }
}

export const config: SubscriberConfig = {
  event: "product_review.created",
};
