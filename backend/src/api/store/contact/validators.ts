import { z } from "@medusajs/framework/zod";

export const PostStoreContactSchema = z.object({
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  email: z.string().trim().email(),
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(20).max(5000),
  company: z.string().trim().max(0).optional().default(""),
});

export type PostStoreContactSchema = z.infer<typeof PostStoreContactSchema>;
