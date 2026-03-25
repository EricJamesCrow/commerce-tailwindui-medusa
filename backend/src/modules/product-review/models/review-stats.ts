import { model } from "@medusajs/framework/utils";

const ReviewStats = model.define("review_stats", {
  id: model.id().primaryKey(),
  product_id: model.text().unique(),
  average_rating: model.float().default(0),
  review_count: model.number().default(0),
  rating_count_1: model.number().default(0),
  rating_count_2: model.number().default(0),
  rating_count_3: model.number().default(0),
  rating_count_4: model.number().default(0),
  rating_count_5: model.number().default(0),
});

export default ReviewStats;
