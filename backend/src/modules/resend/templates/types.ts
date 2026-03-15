import type { EmailBrandConfig } from "./_config/email-config";

export interface BaseTemplateProps {
  theme?: "light" | "dark";
  brandConfig?: Partial<EmailBrandConfig>;
}

import type { LineItem } from "./_components/line-items";
export type { LineItem };

/** Extended line item for ecommerce templates needing richer item display */
export interface CommerceLineItem extends LineItem {
  imageUrl?: string;
  variant?: string;
  sku?: string;
}

/** Shipping/billing address */
export interface Address {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  phone?: string;
}
