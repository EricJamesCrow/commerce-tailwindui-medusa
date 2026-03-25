import { test as authTest, expect } from "./auth.fixture";
import type { Page } from "@playwright/test";

type CheckoutFixtures = {
  /** A guest page with an item in cart, already on /checkout */
  guestCheckoutPage: Page;
  /** An authenticated page with an item in cart, already on /checkout */
  authedCheckoutPage: Page;
};

/**
 * Navigate to first available product, add to cart, and go to /checkout.
 * Works for both guest and authed pages.
 */
async function addToCartAndCheckout(page: Page): Promise<void> {
  // Navigate to /search which reliably lists all products.
  // Retry navigation if the page fails to render (dev server overload).
  for (let navAttempt = 0; navAttempt < 3; navAttempt++) {
    await page.goto("/search");
    await page.waitForLoadState("networkidle");
    const hasContent = await page
      .locator('a[href^="/product/"]')
      .first()
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    if (hasContent) break;
    // Page is blank — reload
    await page.waitForTimeout(2_000);
  }

  // Click the first visible product link (one that has an image)
  const productLink = page
    .locator('a[href^="/product/"]')
    .filter({ has: page.locator("img") })
    .first();
  await expect(productLink).toBeVisible({ timeout: 15_000 });
  const productHref = await productLink.getAttribute("href");
  if (!productHref) {
    throw new Error("Could not determine product URL from search results");
  }
  await page.goto(productHref);
  await page.waitForURL("**/product/**");
  await page.waitForLoadState("networkidle");

  // Wait for Add To Cart button to appear (either enabled or disabled variant prompt)
  const anyAddButton = page.locator(
    'button[aria-label="Add to cart"], button[aria-label="Please select an option"]',
  );
  await expect(anyAddButton.first()).toBeVisible({ timeout: 15_000 });

  // If product has variant options, the button shows "Please select an option" (disabled).
  // Select the first available variant option.
  const disabledAdd = page.locator(
    'button[aria-label="Please select an option"]',
  );
  if (await disabledAdd.isVisible({ timeout: 2_000 }).catch(() => false)) {
    // Variant option buttons are in a fieldset/group. Find any non-disabled,
    // non-aria-labelled button that looks like a size/color option.
    const variantButton = page
      .locator('button:not([disabled]):not([aria-label]):not([type="submit"])')
      .filter({ hasText: /^[A-Z0-9/]{1,10}$/ })
      .first();
    if (await variantButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await variantButton.click();
      // Wait for the Add to cart button to become enabled
      await expect(
        page.locator('button[aria-label="Add to cart"]'),
      ).toBeVisible({ timeout: 5_000 });
    }
  }

  // Click "Add To Cart" — enabled button with aria-label="Add to cart"
  const addToCartButton = page.locator('button[aria-label="Add to cart"]');
  await expect(addToCartButton).toBeVisible({ timeout: 15_000 });
  await addToCartButton.click();

  // Wait for cart drawer/panel to appear and click Checkout
  const checkoutButton = page.locator('button:has-text("Checkout")');
  await expect(checkoutButton).toBeVisible({ timeout: 10_000 });
  await checkoutButton.click();

  // Wait for checkout page
  await page.waitForURL("**/checkout", { timeout: 15_000 });
  await page.waitForLoadState("networkidle");
}

// Test data constants
export const TEST_ADDRESS = {
  first_name: "Test",
  last_name: "Buyer",
  address_1: "123 Test Street",
  city: "New York",
  province: "NY",
  postal_code: "10001",
  country_code: "us",
} as const;

export const STRIPE_TEST_CARD = {
  number: "4242424242424242",
  expiry: "1230",
  cvc: "123",
} as const;

/**
 * Fill Stripe PaymentElement card fields.
 *
 * PaymentElement renders with accordion layout inside an iframe titled
 * "Secure payment input frame". Two such iframes exist (one from
 * ExpressCheckout, one from PaymentElement). We find the one containing
 * the "Card" accordion, click it to expand, then fill the nested card
 * field iframes.
 */
async function fillStripeCard(page: Page): Promise<void> {
  // Step 1: Find the Stripe PaymentElement frame that contains the "Card" accordion.
  // Multiple iframes share the same title, so we iterate page.frames().
  await page.waitForTimeout(3_000);

  let paymentFrame = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    for (const frame of page.frames()) {
      const cardText = frame.locator("text=Card");
      if (
        await cardText
          .first()
          .isVisible({ timeout: 1_000 })
          .catch(() => false)
      ) {
        paymentFrame = frame;
        break;
      }
    }
    if (paymentFrame) break;
    await page.waitForTimeout(2_000);
  }

  if (!paymentFrame) {
    throw new Error(
      "Could not find Stripe PaymentElement frame with Card accordion",
    );
  }

  // Step 2: Click "Card" to expand the card form
  await paymentFrame.locator("text=Card").first().click();
  await page.waitForTimeout(2_000);

  // Step 3: Fill card fields — each is in its own nested iframe.
  // Stripe requires keydown/keyup events, so we use pressSequentially
  // instead of fill() to properly trigger Stripe's internal validation.
  async function typeInFrame(
    selectors: string,
    value: string,
    required = true,
  ): Promise<boolean> {
    for (let attempt = 0; attempt < 5; attempt++) {
      for (const frame of page.frames()) {
        const input = frame.locator(selectors);
        if (
          await input
            .first()
            .isVisible({ timeout: 500 })
            .catch(() => false)
        ) {
          await input.first().click();
          await input.first().pressSequentially(value, { delay: 50 });
          return true;
        }
      }
      if (!required) return false;
      await page.waitForTimeout(1_500);
    }
    if (required) {
      throw new Error(
        `Could not find input matching "${selectors}" in any frame`,
      );
    }
    return false;
  }

  await typeInFrame(
    '[placeholder="1234 1234 1234 1234"], [name="cardnumber"], [name="number"], [autocomplete="cc-number"], [aria-label*="Card number" i], [data-elements-stable-field-name="cardNumber"]',
    STRIPE_TEST_CARD.number,
  );
  await typeInFrame(
    '[placeholder="MM / YY"], [name="exp-date"], [name="expiry"], [autocomplete="cc-exp"], [aria-label*="expir" i], [data-elements-stable-field-name="cardExpiry"]',
    STRIPE_TEST_CARD.expiry,
  );
  await typeInFrame(
    '[placeholder="CVC"], [name="cvc"], [autocomplete="cc-csc"], [aria-label*="CVC" i], [data-elements-stable-field-name="cardCvc"]',
    STRIPE_TEST_CARD.cvc,
  );
  // ZIP code — Stripe may render it with various placeholders
  await typeInFrame(
    '[placeholder="12345"], [placeholder="ZIP"], [name="postal"], [aria-label*="ZIP" i], [autocomplete="postal-code"]',
    "10001",
    false, // ZIP is optional
  );
}

/**
 * Select a shipping option, handling the case where the single option
 * is already pre-checked (clicking a checked radio doesn't fire onChange).
 */
async function selectShippingOption(page: Page): Promise<void> {
  const radio = page.locator('input[name="shipping-option"]').first();
  await expect(radio).toBeAttached({ timeout: 15_000 });

  // If the radio is already checked, uncheck it first so clicking fires onChange
  const isChecked = await radio.isChecked();
  if (isChecked) {
    await radio.evaluate((el) => {
      (el as HTMLInputElement).checked = false;
    });
  }

  // Now click to check it — this fires the React onChange handler
  await radio.click({ force: true });
}

export const test = authTest.extend<CheckoutFixtures>({
  guestCheckoutPage: async ({ guestPage }, use) => {
    await addToCartAndCheckout(guestPage);
    await use(guestPage);
  },

  authedCheckoutPage: async ({ authedPage }, use) => {
    await addToCartAndCheckout(authedPage);
    await use(authedPage);
  },
});

export { expect };

// Re-export helpers for tests
export { addToCartAndCheckout, fillStripeCard, selectShippingOption };
