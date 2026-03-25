import { z } from "@medusajs/framework/zod";

export const WishlistNameSchema = z.object({
  name: z.string().optional(),
});

export const PostCreateWishlistItemSchema = z.object({
  variant_id: z.string(),
});
