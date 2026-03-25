import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Email is required")
  .max(254, "Email is too long")
  .email("Invalid email format");

export const addressSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(100),
  last_name: z.string().trim().min(1, "Last name is required").max(100),
  address_1: z.string().trim().min(1, "Address is required").max(200),
  address_2: z.string().trim().max(200).optional(),
  company: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1, "City is required").max(100),
  country_code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z]{2}$/, "Country code must be a 2-letter ISO code"),
  province: z.string().trim().max(100).optional(),
  postal_code: z.string().trim().min(1, "Postal code is required").max(20),
  phone: z.string().trim().max(30).optional(),
});

// Provider IDs follow the pattern "pp_<provider>_<id>" (e.g. "pp_stripe_stripe", "pp_system_default")
export const providerIdSchema = z
  .string()
  .trim()
  .min(1, "Provider ID is required")
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/, "Invalid provider ID format");

// Payment data is provider-specific; validate it is a plain object (not an array or primitive)
export const paymentDataSchema = z.record(z.string(), z.unknown()).optional();
