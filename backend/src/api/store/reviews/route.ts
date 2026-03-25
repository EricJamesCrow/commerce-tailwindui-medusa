import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { createReviewWorkflow } from "../../../workflows/create-review";
import { z } from "@medusajs/framework/zod";

/** Returns the allowed image hostname from S3_FILE_URL, or null if not configured. */
function getAllowedImageHostname(): string | null {
  const fileUrl = process.env.S3_FILE_URL;
  if (!fileUrl) return null;
  try {
    return new URL(fileUrl).hostname;
  } catch {
    return null;
  }
}

export const PostStoreReviewSchema = z.object({
  title: z.string().optional(),
  content: z.string(),
  rating: z.preprocess((val) => {
    if (val && typeof val === "string") {
      return parseInt(val);
    }
    return val;
  }, z.number().min(1).max(5)),
  product_id: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  images: z
    .array(
      z.object({
        url: z
          .string()
          .url()
          .refine(
            (val) => {
              const allowed = getAllowedImageHostname();
              if (!allowed) return true; // graceful degradation when env not set
              try {
                return new URL(val).hostname === allowed;
              } catch {
                return false;
              }
            },
            { message: "Image URL hostname is not allowed" },
          ),
        sort_order: z.number().int().min(0),
      }),
    )
    .max(3)
    .optional(),
});

type PostStoreReviewReq = z.infer<typeof PostStoreReviewSchema>;

export const POST = async (
  req: AuthenticatedMedusaRequest<PostStoreReviewReq>,
  res: MedusaResponse,
) => {
  const input = req.validatedBody;

  const { result } = await createReviewWorkflow(req.scope).run({
    input: {
      ...input,
      customer_id: req.auth_context?.actor_id,
      status: "approved",
    },
  });

  res.json(result);
};
