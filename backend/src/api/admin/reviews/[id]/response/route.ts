import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { z } from "@medusajs/framework/zod";
import { createReviewResponseWorkflow } from "../../../../../workflows/create-review-response";
import { updateReviewResponseWorkflow } from "../../../../../workflows/update-review-response";
import { deleteReviewResponseWorkflow } from "../../../../../workflows/delete-review-response";
import { PRODUCT_REVIEW_MODULE } from "../../../../../modules/product-review";
import type ProductReviewModuleService from "../../../../../modules/product-review/service";

export const PostAdminReviewResponseSchema = z.object({
  content: z.string().min(1),
});

type PostAdminReviewResponseReq = z.infer<typeof PostAdminReviewResponseSchema>;

export const POST = async (
  req: AuthenticatedMedusaRequest<PostAdminReviewResponseReq>,
  res: MedusaResponse,
) => {
  const reviewId = req.params.id;
  const { content } = req.validatedBody;

  const service: ProductReviewModuleService = req.scope.resolve(
    PRODUCT_REVIEW_MODULE,
  );

  // Check if response already exists (upsert pattern)
  const existing = await service.listReviewResponses({ review_id: reviewId });

  if (existing[0]) {
    // Update existing response
    const { result } = await updateReviewResponseWorkflow(req.scope).run({
      input: {
        id: existing[0].id,
        content,
      },
    });
    return res.json({ product_review_response: result.response });
  }

  // Create new response
  const { result } = await createReviewResponseWorkflow(req.scope).run({
    input: {
      review_id: reviewId,
      content,
    },
  });

  return res.json({ product_review_response: result.response });
};

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) => {
  const reviewId = req.params.id;

  const service: ProductReviewModuleService = req.scope.resolve(
    PRODUCT_REVIEW_MODULE,
  );

  const existing = await service.listReviewResponses({ review_id: reviewId });

  if (!existing[0]) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No response found for this review",
    );
  }

  await deleteReviewResponseWorkflow(req.scope).run({
    input: { id: existing[0].id },
  });

  res.json({ message: "Response deleted" });
};
