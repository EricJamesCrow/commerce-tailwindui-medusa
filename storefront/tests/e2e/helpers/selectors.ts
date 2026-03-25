/**
 * Shared selectors for E2E tests.
 * Derived from actual component markup in:
 * - components/wishlist/ (wishlist-button, wishlist-page-client)
 * - app/wishlist/shared/[token]/page.tsx
 * - components/reviews/ (ReviewForm, ReviewList, ReviewImageLightbox)
 */

// Heart button (PDP and product cards)
export const HEART_BUTTON =
  'button[aria-label="Add to wishlist"], button[aria-label="Remove from wishlist"]';
export const HEART_ADD = 'button[aria-label="Add to wishlist"]';
export const HEART_REMOVE = 'button[aria-label="Remove from wishlist"]';

// Wishlist page
export const WISHLIST_TABS = 'nav[aria-label="Wishlists"]';
export const WISHLIST_TAB = 'nav[aria-label="Wishlists"] button';
export const SHARE_BUTTON = 'button:has-text("Share")';
export const NEW_WISHLIST_BUTTON = 'button:has-text("New Wishlist")';
export const REMOVE_ITEM_BUTTON =
  'button[aria-label="Remove from wishlist"]';
export const ADD_TO_CART_BUTTON = 'button:has-text("Add to Cart")';
export const EMPTY_STATE_HEADING = 'h3:has-text("No saved items yet")';
export const BROWSE_PRODUCTS_LINK = 'a:has-text("Browse Products")';

// New wishlist dialog
export const WISHLIST_NAME_INPUT = "#wishlist-name";
export const CREATE_BUTTON =
  'button[type="submit"]:has-text("Create")';
export const CANCEL_BUTTON = 'button:has-text("Cancel")';

// Shared wishlist page
export const SHARED_WISHLIST_TITLE = "h1";
export const IMPORT_BUTTON =
  'button:has-text("Import to My Wishlist")';
export const SIGN_IN_LINK = 'main a:has-text("Sign In")';
export const WISHLIST_NOT_AVAILABLE =
  'h1:has-text("Wishlist Not Available")';

// Wishlist actions menu (rename/delete)
export const ACTIONS_MENU_BUTTON =
  'button:has(span:has-text("Wishlist options"))';
export const RENAME_MENU_ITEM = '[role="menuitem"]:has-text("Rename")';
export const DELETE_MENU_ITEM = '[role="menuitem"]:has-text("Delete")';
export const RENAME_DIALOG_TITLE = 'h3:has-text("Rename Wishlist")';
export const RENAME_INPUT = "#rename-wishlist";
export const RENAME_SUBMIT = 'button[type="submit"]:has-text("Rename")';
export const DELETE_DIALOG_TITLE = 'h3:has-text("Delete Wishlist")';
export const DELETE_CONFIRM = 'button:has-text("Delete"):not([class*="text-red-600"])';

// Nav wishlist badge
export const NAV_WISHLIST_LINK = 'header a[href="/account/wishlist"]';

// Social proof
export const SOCIAL_PROOF_TEXT = 'p:has-text("saved this")';

// Auth forms
export const LOGIN_EMAIL = 'main form input[name="email"]';
export const LOGIN_PASSWORD = 'main form input[name="password"]';
export const LOGIN_SUBMIT = 'main form button[type="submit"]';
export const REGISTER_FIRST_NAME = 'input[name="first_name"]';
export const REGISTER_LAST_NAME = 'input[name="last_name"]';
export const REGISTER_EMAIL = 'main form input[name="email"]';
export const REGISTER_PASSWORD = 'main form input[name="password"]';

// Reviews — summary & CTA
export const REVIEW_SECTION_HEADING = 'h2:has-text("Customer Reviews")';
export const WRITE_REVIEW_BUTTON = 'button:has-text("Write a review")';
export const REVIEW_COUNT_TEXT = 'p:has-text("Based on")';

// Reviews — form dialog
export const REVIEW_FORM = '[data-testid="review-form"]';
export const REVIEW_DIALOG_TITLE = 'h2:has-text("Write a review")'; // keep text-based (DialogTitle)
export const REVIEW_TITLE_INPUT = '[data-testid="review-title-input"]';
export const REVIEW_CONTENT_INPUT = '[data-testid="review-content-input"]';
export const REVIEW_SUBMIT_BUTTON = '[data-testid="review-submit-button"]';
export const REVIEW_SUCCESS_TITLE = 'h2:has-text("Thank you!")'; // keep text-based
export const REVIEW_SUCCESS_DONE = 'button:has-text("Done")'; // keep text-based
export const REVIEW_ERROR_MESSAGE = '[data-testid="review-error-message"]';

// Reviews — star rating (form dialog)
export const REVIEW_STAR_BUTTON = (n: number) => `[data-testid="review-star-${n}"]`;

// Reviews — image upload (form dialog)
export const REVIEW_PHOTO_LABEL = 'label:has-text("Photos")'; // keep text-based
export const REVIEW_FILE_INPUT = '[data-testid="review-file-input"]';
export const REVIEW_IMAGE_THUMBNAIL = '[data-testid="review-image-preview"]';
export const REVIEW_IMAGE_REMOVE = '[data-testid="review-image-remove"]';
export const REVIEW_ADD_PHOTO_LABEL = '[data-testid="review-add-photo-label"]';

// Reviews — list
export const REVIEW_LIST_ITEM = '[data-testid="review-item"]';
export const REVIEW_REVIEWER_NAME = '[data-testid="review-author-name"]';
export const REVIEW_CONTENT_TEXT = '[data-testid="review-content-text"]';
export const REVIEW_TITLE_TEXT = '[data-testid="review-title-text"]';

// Reviews — admin response (in list)
export const REVIEW_STORE_RESPONSE = '[data-testid="review-store-response"]';
export const REVIEW_STORE_RESPONSE_LABEL = 'p:has-text("Store response")'; // keep text-based

// Reviews — image thumbnails (in list)
export const REVIEW_LIST_THUMBNAIL = '[data-testid="review-image-thumbnail"]';

// Reviews — lightbox
export const REVIEW_LIGHTBOX_DIALOG = '[data-testid="review-lightbox"]';
export const REVIEW_LIGHTBOX_PANEL = '[data-testid="review-lightbox"]';
export const REVIEW_LIGHTBOX_IMAGE = '[data-testid="review-lightbox-image"]';
export const REVIEW_LIGHTBOX_CLOSE = '[data-testid="review-lightbox-close"]';
export const REVIEW_LIGHTBOX_PREV = '[data-testid="review-lightbox-prev"]';
export const REVIEW_LIGHTBOX_NEXT = '[data-testid="review-lightbox-next"]';

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

// Email step
export const CHECKOUT_EMAIL_INPUT = "#checkout-email";
export const CHECKOUT_CONTINUE_BUTTON = 'button:has-text("Continue")';
export const SIGNED_IN_AS = 'p:has-text("Signed in as")';

// Address step (shipping form uses idPrefix="shipping")
export const ADDR_FIRST_NAME = "#shipping-first-name";
export const ADDR_LAST_NAME = "#shipping-last-name";
export const ADDR_ADDRESS1 = "#shipping-address1";
export const ADDR_CITY = "#shipping-city";
export const ADDR_PROVINCE = "#shipping-province";
export const ADDR_POSTAL_CODE = "#shipping-postal-code";
export const ADDR_COUNTRY = "#shipping-country";

// Shipping step
export const SHIPPING_OPTION = 'input[name="shipping-option"]';

// Payment step
export const PAYMENT_CONTINUE_BUTTON = 'button:has-text("Continue to review")';

// Review step
export const PLACE_ORDER_BUTTON = 'button:has-text("Place Order")';
export const CHECKOUT_REVIEW_CONTACT_DT = 'dt:has-text("Contact")';
export const CHECKOUT_REVIEW_SHIP_TO_DT = 'dt:has-text("Ship to")';
export const CHECKOUT_REVIEW_BILL_TO_DT = 'dt:has-text("Bill to")';
export const CHECKOUT_REVIEW_SHIPPING_METHOD_DT = 'dt:has-text("Shipping method")';
export const CHECKOUT_REVIEW_PAYMENT_DT = 'dt:has-text("Payment")';

// Order summary (left column)
export const ORDER_SUMMARY_HEADING = 'h2:has-text("Order summary")';
export const ORDER_SUMMARY_ITEM = 'ul[role="list"] li';
export const ORDER_SUMMARY_EDIT_LINK =
  'a.font-medium.text-primary-600[href*="/product/"]';
export const ORDER_SUMMARY_REMOVE_BUTTON = 'button:has-text("Remove")';
export const ORDER_SUMMARY_SUBTOTAL = 'dt:has-text("Subtotal")';
export const ORDER_SUMMARY_TOTAL = 'dt:has-text("Total")';

// Accordion step headings
export const STEP_HEADING_ACTIVE = "h2.text-lg.font-medium.text-gray-900";
export const STEP_DISABLED_BUTTON =
  "button:disabled.text-lg.font-medium.text-gray-500";
export const STEP_EDIT_BUTTON =
  'button.text-primary-600:has-text("Edit")';

// Express Checkout
export const EXPRESS_CHECKOUT_DIVIDER = 'span:has-text("or")';

// Order confirmation
export const ORDER_CONFIRMED_HEADING = 'h1:has-text("Thank you!")';
export const ORDER_CONFIRMED_SUBTITLE =
  'p:has-text("Your order is confirmed")';
export const CONTINUE_SHOPPING_LINK = 'a:has-text("Continue Shopping")';
