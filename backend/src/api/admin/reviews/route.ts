import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { createFindParams } from "@medusajs/medusa/api/utils/validators";

export const GetAdminReviewsSchema = createFindParams();
const VERIFIED_PURCHASE_FIELDS = ["order_id", "order_line_item_id"] as const;

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve("query");
  const fields = Array.from(
    new Set([...(req.queryConfig.fields ?? []), ...VERIFIED_PURCHASE_FIELDS]),
  );

  const {
    data: rawReviews,
    metadata: { count, take, skip } = {
      count: 0,
      take: 20,
      skip: 0,
    },
  } = await query.graph({
    entity: "review",
    ...req.queryConfig,
    fields,
  });

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
  });
};
