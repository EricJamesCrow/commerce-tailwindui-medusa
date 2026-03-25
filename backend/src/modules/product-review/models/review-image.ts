import { model } from "@medusajs/framework/utils";
import Review from "./review";

const ReviewImage = model.define("review_image", {
  id: model.id({ prefix: "revi" }).primaryKey(),
  url: model.text(),
  sort_order: model.number().default(0),
  review: model.belongsTo(() => Review, {
    mappedBy: "images",
  }),
});

export default ReviewImage;
