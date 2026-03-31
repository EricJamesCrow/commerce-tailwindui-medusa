import { z } from "@medusajs/framework/zod";

export const SubscribeSchema = z.object({
  email: z.string().email(),
  source: z.enum(["footer", "checkout", "account", "import"]).default("footer"),
  company: z
    .string()
    .trim()
    .max(200)
    .transform((value) => value.replace(/[\u0000-\u001F\u007F]/g, ""))
    .optional(),
});

export const UnsubscribeSchema = z.object({
  token: z.string().min(1),
});

export const EmailPreferencesSchema = z.object({
  newsletter_enabled: z.boolean(),
  order_updates_enabled: z.boolean(),
});

export const TokenEmailPreferencesSchema = EmailPreferencesSchema.extend({
  token: z.string().min(1),
});

export const GetEmailPreferencesQuerySchema = z.object({
  token: z.string().min(1),
});
