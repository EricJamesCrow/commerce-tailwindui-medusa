import type posthog from "posthog-js";

// ---------------------------------------------------------------------------
// Event catalog
// ---------------------------------------------------------------------------

export type AnalyticsEvents = {
  // --- Cart ---
  product_added_to_cart: {
    product_id: string;
    variant_id: string;
    quantity: number;
    price: number;
  };
  cart_item_removed: { product_id: string; variant_id: string };
  cart_item_updated: {
    product_id: string;
    variant_id: string;
    new_quantity: number;
  };

  // --- Checkout ---
  checkout_started: {
    cart_id: string;
    item_count: number;
    cart_total: number;
  };
  checkout_step_completed: {
    step_name: "email" | "address" | "shipping" | "payment" | "review";
    step_number: number;
  };
  order_completed: {
    order_id: string;
    order_total: number;
    item_count: number;
    currency_code: string;
  };

  // --- Auth ---
  customer_signed_up: { method: string };
  customer_logged_in: { method: string };
  customer_logged_out: Record<string, never>;
  password_reset_requested: Record<string, never>;
  password_reset_completed: Record<string, never>;

  // --- Account ---
  profile_updated: { fields_changed: string[] };
  address_added: { country_code: string };
  address_updated: { country_code: string };
  address_deleted: Record<string, never>;

  // --- Rate limiting ---
  auth_rate_limited: { action: "login" | "signup" | "password-reset" };

  // --- Wishlist ---
  wishlist_item_added: {
    product_id: string;
    variant_id: string;
    wishlist_id: string;
  };
  wishlist_item_removed: {
    product_id: string;
    variant_id: string;
    wishlist_id: string;
  };
  wishlist_shared: { wishlist_id: string; item_count: number };
  wishlist_created: {
    wishlist_id: string;
    has_name: boolean;
    name_length: number;
  };
  wishlist_renamed: { wishlist_id: string };
  wishlist_deleted: { wishlist_id: string };
  wishlist_imported: { wishlist_id: string; item_count: number };

  // --- Reviews ---
  review_submitted: {
    product_id: string;
    rating: number;
    has_images: boolean;
    status: "pending" | "approved" | "flagged";
    verified_purchase: boolean;
  };

  // --- Search ---
  search_performed: {
    query: string;
    result_count: number;
    source: "meilisearch" | "medusa";
  };
  search_facet_applied: {
    facet_type: string;
    facet_value: string;
    query: string;
  };
  search_result_clicked: {
    query: string;
    product_id: string;
    position: number;
    source: "meilisearch" | "medusa";
  };

  // --- Product ---
  product_viewed: {
    product_id: string;
    product_name: string;
    price: number;
    category: string;
    variant_count: number;
    has_reviews: boolean;
    avg_rating: number;
  };

  // --- Orders ---
  order_detail_viewed: {
    order_id: string;
    display_id: number;
    item_count: number;
  };
  invoice_downloaded: { order_id: string };
  reorder_initiated: { order_id: string };
  reorder_failed: { order_id: string; error_code: string };
  abandoned_cart_recovered: { cart_id: string; item_count: number };

  // --- Newsletter ---
  newsletter_subscribed: { source: "footer" };
  newsletter_subscribe_failed: { source: "footer"; error: string };

  // --- Client-side UI ---
  cart_drawer_opened: Record<string, never>;
  product_quick_view_opened: { product_id: string };
  search_command_opened: Record<string, never>;
  search_command_closed: Record<string, never>;
  collection_filter_changed: { filter_type: string; filter_value: string };
  sort_option_selected: { sort_key: string };
  mobile_menu_opened: Record<string, never>;
  mobile_filters_opened: Record<string, never>;
  product_variant_selected: {
    product_id: string;
    option_name: string;
    option_value: string;
  };
  product_image_viewed: { product_id: string; image_index: number };
  product_details_expanded: { product_id: string; section_name: string };
  review_form_opened: { product_id: string };
  wishlist_tab_switched: { wishlist_id: string };
  checkout_step_edited: { step_name: string };
  checkout_payment_failed: { error_code: string; error_message: string };
  checkout_payment_success_order_failed: {
    had_cart: boolean;
    had_payment_intent: boolean;
  };
  checkout_shipping_no_options: {
    has_shipping_address: boolean;
    has_postal_code: boolean;
  };
};

// ---------------------------------------------------------------------------
// PII redaction for analytics properties
// ---------------------------------------------------------------------------

const EMAIL_PATTERN = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const PHONE_PATTERN =
  /(?:\+?1[\s\-.]?)?(?:\(?\d{3}\)?[\s\-.]?)\d{3}[\s\-.]?\d{4}/g;

/**
 * Normalize, truncate, and strip email/phone patterns from a search query
 * before sending to analytics. Prevents accidental PII capture when users
 * type their email or phone into the search box.
 */
export function redactPiiFromQuery(query: string): string {
  return query
    .trim()
    .replace(EMAIL_PATTERN, "[email]")
    .replace(PHONE_PATTERN, "[phone]")
    .slice(0, 80);
}

// ---------------------------------------------------------------------------
// Client-side tracking (safe to import from client components)
// ---------------------------------------------------------------------------

let posthogInstance: typeof posthog | null = null;

export function setPostHogClient(instance: typeof posthog): void {
  posthogInstance = instance;
}

export function trackClient<E extends keyof AnalyticsEvents>(
  event: E,
  properties: AnalyticsEvents[E],
): void {
  if (!posthogInstance) return;
  posthogInstance.capture(event, properties as Record<string, unknown>);
}
