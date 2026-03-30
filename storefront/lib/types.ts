import type { HttpTypes } from "@medusajs/types";

export type Cart = {
  id: string | undefined;
  checkoutUrl: string;
  cost: {
    subtotalAmount: Money;
    totalAmount: Money;
    totalTaxAmount: Money;
  };
  lines: CartItem[];
  totalQuantity: number;
};

export type CartProduct = {
  id: string;
  handle: string;
  title: string;
  featuredImage: Image;
};

export type CartItem = {
  id: string | undefined;
  quantity: number;
  cost: {
    totalAmount: Money;
  };
  merchandise: {
    id: string;
    title: string;
    selectedOptions: {
      name: string;
      value: string;
    }[];
    product: CartProduct;
  };
};

export type Collection = {
  handle: string;
  title: string;
  description: string;
  seo: SEO;
  updatedAt: string;
  path: string;
  image?: Image;
};

export type Image = {
  url: string;
  altText: string;
  width: number;
  height: number;
};

export type Menu = {
  title: string;
  path: string;
};

export type Money = {
  amount: string;
  currencyCode: string;
};

export type Page = {
  id: string;
  title: string;
  handle: string;
  body: string;
  bodySummary: string;
  seo?: SEO;
  createdAt: string;
  updatedAt: string;
};

export type Product = {
  id: string;
  handle: string;
  availableForSale: boolean;
  title: string;
  description: string;
  descriptionHtml: string;
  options: ProductOption[];
  priceRange: {
    maxVariantPrice: Money;
    minVariantPrice: Money;
  };
  variants: ProductVariant[];
  featuredImage: Image;
  images: Image[];
  seo: SEO;
  tags: string[];
  updatedAt: string;
};

export type ProductOption = {
  id: string;
  name: string;
  values: string[];
};

export type ProductVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  sku?: string;
  selectedOptions: {
    name: string;
    value: string;
  }[];
  price: Money;
};

export type SEO = {
  title: string;
  description: string;
};

export type NavigationLink = {
  name: string;
  href: string;
};

export type NavigationCategory = {
  name: string;
  featured: NavigationLink[];
  categories: NavigationLink[];
  collection: NavigationLink[];
  brands: NavigationLink[];
};

export type Navigation = {
  categories: NavigationCategory[];
  pages: NavigationLink[];
};

// --- Reviews ---

export type ReviewImage = {
  id: string;
  url: string;
  sort_order: number;
};

export type ReviewResponse = {
  id: string;
  content: string;
  created_at: string;
};

export type Review = {
  id: string;
  title: string;
  content: string;
  rating: number;
  first_name: string;
  last_name: string;
  created_at: string;
  verified_purchase: boolean;
  images: ReviewImage[];
  response: ReviewResponse | null;
};

export type ProductReviews = {
  reviews: Review[];
  averageRating: number;
  count: number;
  ratingDistribution: { rating: number; count: number }[];
};

// --- Wishlists ---

/** Raw Medusa product returned by graph query (not transformed) */
export type WishlistProduct = {
  id: string;
  title: string;
  handle: string;
  thumbnail: string | null;
  description: string | null;
};

export type WishlistItem = {
  id: string;
  product_variant_id: string;
  wishlist_id: string;
  product_variant?: {
    id: string;
    title: string;
    sku: string;
    product_id: string;
    product?: WishlistProduct;
  };
  created_at: string;
};

export type Wishlist = {
  id: string;
  name: string | null;
  customer_id: string | null;
  sales_channel_id: string;
  items: WishlistItem[];
  created_at: string;
  updated_at: string;
};

// --- Checkout ---

export type CheckoutStep =
  | "email"
  | "address"
  | "shipping"
  | "payment"
  | "review";

export type AddressPayload = {
  first_name: string;
  last_name: string;
  address_1: string;
  address_2?: string;
  company?: string;
  city: string;
  country_code: string;
  province?: string;
  postal_code: string;
  phone?: string;
};

export type ShippingOption = {
  id: string;
  name: string;
  price_type: "flat" | "calculated";
  amount: number;
  currency_code: string;
};

export type SavedPaymentMethod = {
  id: string;
  provider_id: string;
  data: {
    card: {
      brand: string;
      last4: string;
      exp_month: number;
      exp_year: number;
    };
  };
};

export type CartCompletionResult =
  | { type: "order"; order: HttpTypes.StoreOrder }
  | { type: "cart"; error: string };
