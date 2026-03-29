import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { PRODUCT_REVIEW_MODULE } from "../../../../../modules/product-review";
import ProductReviewModuleService from "../../../../../modules/product-review/service";
import { createFindParams } from "@medusajs/medusa/api/utils/validators";

export const GetStoreReviewsSchema = createFindParams();
const VERIFIED_PURCHASE_FIELDS = ["order_id", "order_line_item_id"] as const;

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params;

  const query = req.scope.resolve("query");
  const reviewService: ProductReviewModuleService = req.scope.resolve(
    PRODUCT_REVIEW_MODULE,
  );
  const fields = Array.from(
    new Set([...(req.queryConfig.fields ?? []), ...VERIFIED_PURCHASE_FIELDS]),
  );

  const [queryResult, averageRating, ratingDistribution] = await Promise.all([
    query.graph({
      entity: "review",
      filters: {
        product_id: id,
        status: "approved",
      },
      ...req.queryConfig,
      fields,
    }),
    reviewService.getAverageRating(id),
    reviewService.getRatingDistribution(id),
  ]);

  const {
    data: rawReviews,
    metadata: { count, take, skip } = { count: 0, take: 10, skip: 0 },
  } = queryResult;

  const reviews = rawReviews.map(
    (
      review: Record<string, unknown> & {
        order_id?: string | null;
        order_line_item_id?: string | null;
      },
    ) => {
      const {
        order_id: _orderId,
        order_line_item_id: _orderLineItemId,
        ...rest
      } = review;

      return {
        ...rest,
        verified_purchase: Boolean(
          review.order_id && review.order_line_item_id,
        ),
      };
    },
  );

  res.json({
    reviews,
    count,
    limit: take,
    offset: skip,
    average_rating: averageRating,
    rating_distribution: ratingDistribution,
  });
};
