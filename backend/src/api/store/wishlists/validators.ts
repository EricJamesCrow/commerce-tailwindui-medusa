import { z } from "@medusajs/framework/zod";

export const PostGuestCreateWishlistItemSchema = z.object({
  variant_id: z.string(),
});

export const PostImportWishlistSchema = z.object({
  share_token: z.string(),
});
