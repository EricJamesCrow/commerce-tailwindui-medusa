import { model } from "@medusajs/framework/utils";
import ReviewResponse from "./review-response";
import ReviewImage from "./review-image";

const Review = model
  .define("review", {
    id: model.id().primaryKey(),
    title: model.text().nullable(),
    content: model.text(),
    rating: model.float(),
    first_name: model.text(),
    last_name: model.text(),
    status: model.enum(["pending", "approved", "flagged"]).default("pending"),
    product_id: model.text().index("IDX_REVIEW_PRODUCT_ID"),
    customer_id: model.text().nullable(),
    order_id: model.text().nullable(),
    order_line_item_id: model.text().nullable(),
    response: model.hasOne(() => ReviewResponse).nullable(),
    images: model.hasMany(() => ReviewImage),
  })
  .checks([
    {
      name: "rating_range",
      expression: (columns) =>
        `${columns.rating} >= 1 AND ${columns.rating} <= 5`,
    },
    {
      name: "review_order_link_requires_order",
      expression: (columns) =>
        `${columns.order_line_item_id} IS NULL OR ${columns.order_id} IS NOT NULL`,
    },
  ]);

export default Review;
