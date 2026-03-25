import { model } from "@medusajs/framework/utils";
import Review from "./review";

const ReviewResponse = model.define("review_response", {
  id: model.id({ prefix: "prr" }).primaryKey(),
  content: model.text(),
  review: model.belongsTo(() => Review, {
    mappedBy: "response",
  }),
});

export default ReviewResponse;
