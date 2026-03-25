import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { PRODUCT_REVIEW_MODULE } from "../../../../../modules/product-review";
import ProductReviewModuleService from "../../../../../modules/product-review/service";
import { createFindParams } from "@medusajs/medusa/api/utils/validators";

export const GetStoreReviewsSchema = createFindParams();

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params;

  const query = req.scope.resolve("query");
  const reviewService: ProductReviewModuleService = req.scope.resolve(
    PRODUCT_REVIEW_MODULE,
  );

  const [queryResult, averageRating, ratingDistribution] = await Promise.all([
    query.graph({
      entity: "review",
      filters: {
        product_id: id,
        status: "approved",
      },
      ...req.queryConfig,
    }),
    reviewService.getAverageRating(id),
    reviewService.getRatingDistribution(id),
  ]);

  const {
    data: reviews,
    metadata: { count, take, skip } = { count: 0, take: 10, skip: 0 },
  } = queryResult;

  res.json({
    reviews,
    count,
    limit: take,
    offset: skip,
    average_rating: averageRating,
    rating_distribution: ratingDistribution,
  });
};
