import { test as authTest, expect } from "./auth.fixture";
import { execFileSync } from "child_process";

const BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000";
const STOREFRONT_URL = process.env.STOREFRONT_URL || "http://localhost:3000";
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET || "supersecret";
const DATABASE_URL =
  process.env.DATABASE_URL || "postgres://localhost/medusa_db";
const PSQL =
  process.env.PSQL_PATH || "/opt/homebrew/opt/postgresql@17/bin/psql";

// Fail fast in CI if required env vars are missing
if (process.env.CI) {
  const required: Record<string, string> = {
    DATABASE_URL: "Postgres connection string for direct DB access",
    MEDUSA_BACKEND_URL: "Backend URL for review API calls",
    STOREFRONT_URL: "Storefront URL for cache revalidation",
    NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY: "Medusa publishable API key",
    REVALIDATE_SECRET: "Cache revalidation secret",
  };
  const missing = Object.entries(required)
    .filter(([key]) => !process.env[key])
    .map(([key, desc]) => `  ${key} — ${desc}`);
  if (missing.length > 0) {
    throw new Error(
      `[review.fixture] Missing required env vars in CI:\n${missing.join("\n")}\n\nSet these in your CI environment or .env.test file.`,
    );
  }
}

/**
 * Run a SQL query against the Medusa database.
 * Uses execFileSync (no shell) to avoid command injection.
 */
function runSql(sql: string): string {
  return execFileSync(PSQL, [DATABASE_URL, "-t", "-A", "-c", sql], {
    encoding: "utf8",
    timeout: 10_000,
  }).trim();
}

/**
 * Validates that a Medusa ID matches the expected prefix pattern.
 * Throws before any SQL interpolation to prevent malformed IDs from
 * reaching the database.
 */
function assertMedusaId(id: string, prefix: string): void {
  const pattern = new RegExp(`^${prefix}[a-zA-Z0-9]+$`);
  if (!pattern.test(id)) {
    throw new Error(
      `Invalid Medusa ID format: expected "${prefix}..." but got "${id}"`,
    );
  }
}

/**
 * Approve a review by updating its status directly in the database.
 * Also refreshes the review_stats aggregate table.
 */
function approveReview(reviewId: string): void {
  assertMedusaId(reviewId, "");
  runSql(`UPDATE review SET status = 'approved' WHERE id = '${reviewId}'`);

  // Refresh the review_stats aggregate for this product
  const productId = runSql(
    `SELECT product_id FROM review WHERE id = '${reviewId}'`,
  );
  if (productId) {
    refreshReviewStats(productId);
  }
}

/**
 * Recalculate and upsert review_stats for a product.
 */
function refreshReviewStats(productId: string): void {
  assertMedusaId(productId, "prod_");
  runSql(`
    INSERT INTO review_stats (id, product_id, average_rating, review_count,
      rating_count_1, rating_count_2, rating_count_3, rating_count_4, rating_count_5,
      created_at, updated_at)
    SELECT
      COALESCE(
        (SELECT id FROM review_stats WHERE product_id = '${productId}' AND deleted_at IS NULL),
        'revstat_' || substr(md5(random()::text), 1, 26)
      ),
      '${productId}',
      COALESCE(AVG(rating), 0),
      COUNT(*),
      COUNT(*) FILTER (WHERE rating = 1),
      COUNT(*) FILTER (WHERE rating = 2),
      COUNT(*) FILTER (WHERE rating = 3),
      COUNT(*) FILTER (WHERE rating = 4),
      COUNT(*) FILTER (WHERE rating = 5),
      NOW(), NOW()
    FROM review
    WHERE product_id = '${productId}' AND status = 'approved' AND deleted_at IS NULL
    ON CONFLICT (id)
    DO UPDATE SET
      average_rating = EXCLUDED.average_rating,
      review_count = EXCLUDED.review_count,
      rating_count_1 = EXCLUDED.rating_count_1,
      rating_count_2 = EXCLUDED.rating_count_2,
      rating_count_3 = EXCLUDED.rating_count_3,
      rating_count_4 = EXCLUDED.rating_count_4,
      rating_count_5 = EXCLUDED.rating_count_5,
      updated_at = NOW()
  `);
}

/**
 * Create an admin response on a review directly in the database.
 * Returns the response ID.
 */
function createReviewResponse(reviewId: string, content: string): string {
  assertMedusaId(reviewId, "");
  const id = runSql(
    `INSERT INTO review_response (id, content, review_id, created_at, updated_at)
     VALUES (
       'revresp_' || substr(md5(random()::text), 1, 27),
       '${content.replace(/'/g, "''")}',
       '${reviewId}',
       NOW(),
       NOW()
     ) RETURNING id`,
  );
  return id;
}

/**
 * Insert images for a review directly in the database.
 * Bypasses API hostname validation so E2E tests can use
 * placeholder image URLs regardless of S3_FILE_URL configuration.
 */
function createReviewImages(
  reviewId: string,
  images: { url: string; sort_order: number }[],
): void {
  assertMedusaId(reviewId, "");
  for (const img of images) {
    runSql(
      `INSERT INTO review_image (id, url, sort_order, review_id, created_at, updated_at)
       VALUES (
         'revi_' || substr(md5(random()::text), 1, 26),
         '${img.url.replace(/'/g, "''")}',
         ${img.sort_order},
         '${reviewId}',
         NOW(), NOW()
       )`,
    );
  }
}

/**
 * Invalidate the Next.js cache for reviews so the storefront
 * serves fresh data after direct DB modifications.
 */
async function revalidateReviewsCache(): Promise<void> {
  try {
    const response = await fetch(`${STOREFRONT_URL}/api/revalidate`, {
      method: "POST",
      headers: {
        "x-revalidate-secret": REVALIDATE_SECRET,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Review cache revalidation failed (${response.status}): ${await response.text()}`,
      );
    }
  } catch (error) {
    if (
      error instanceof TypeError ||
      (error instanceof Error &&
        /fetch failed|ECONNREFUSED|ECONNRESET|ENOTFOUND/i.test(error.message))
    ) {
      // Storefront may not be ready; cache will be stale but tests can retry
      return;
    }

    throw error;
  }
}

/**
 * Delete a specific test review by ID (safe for parallel workers).
 */
function cleanupReview(reviewId: string): void {
  assertMedusaId(reviewId, "");
  try {
    runSql(`DELETE FROM review_response WHERE review_id = '${reviewId}'`);
    runSql(`DELETE FROM review_image WHERE review_id = '${reviewId}'`);
    runSql(`DELETE FROM review WHERE id = '${reviewId}'`);
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Build auth headers for store API requests.
 */
function storeHeaders(authToken: string): Record<string, string> {
  return {
    authorization: `Bearer ${authToken}`,
    "Content-Type": "application/json",
    "x-publishable-api-key":
      process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "",
  };
}

/**
 * Create a review via the store API. Returns the new review ID.
 */
async function createReview(
  authToken: string,
  body: Record<string, unknown>,
): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/store/reviews`, {
    method: "POST",
    headers: storeHeaders(authToken),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create review failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { review: { id: string } };
  return data.review.id;
}

export {
  approveReview,
  revalidateReviewsCache,
  cleanupReview,
  createReview,
  createReviewImages,
  storeHeaders,
};

// ---------------------------------------------------------------------------
// Playwright Fixtures
// ---------------------------------------------------------------------------

type ReviewFixtures = {
  /** Creates an approved review on a product, returns review metadata */
  approvedReview: {
    reviewId: string;
    productId: string;
    productHandle: string;
  };
  /** Creates an approved review with an admin response */
  reviewWithResponse: {
    reviewId: string;
    productId: string;
    productHandle: string;
    responseContent: string;
  };
  /** First available product handle for navigation */
  testProductHandle: string;
  /** First available product ID */
  testProductId: string;
};

export const test = authTest.extend<ReviewFixtures>({
  testProductHandle: async ({ api }, use) => {
    const products = await api.getProducts();
    if (products.length < 1) {
      throw new Error("No products found. Run seed script.");
    }
    await use(products[0]!.handle);
  },

  testProductId: async ({ api }, use) => {
    const products = await api.getProducts();
    if (products.length < 1) {
      throw new Error("No products found. Run seed script.");
    }
    await use(products[0]!.id);
  },

  approvedReview: async ({ api }, use) => {
    const products = await api.getProducts();
    if (products.length < 1) {
      throw new Error("No products found. Run seed script.");
    }
    const product = products[0]!;

    const reviewId = await createReview(api.getAuthToken(), {
      product_id: product.id,
      title: "Great product for testing",
      content:
        "This is an E2E test review. The product quality is excellent and delivery was fast.",
      rating: 5,
      first_name: "E2E",
      last_name: "Tester",
    });

    approveReview(reviewId);
    await revalidateReviewsCache();

    await use({
      reviewId,
      productId: product.id,
      productHandle: product.handle,
    });

    cleanupReview(reviewId);
  },

  reviewWithResponse: async ({ api }, use) => {
    const products = await api.getProducts();
    if (products.length < 1) {
      throw new Error("No products found. Run seed script.");
    }
    const product = products[0]!;

    const reviewId = await createReview(api.getAuthToken(), {
      product_id: product.id,
      title: "Review with response",
      content:
        "This review will have an admin response attached for E2E testing.",
      rating: 4,
      first_name: "E2E",
      last_name: "Reviewer",
    });

    approveReview(reviewId);

    const responseContent =
      "Thank you for your review! We appreciate your feedback.";
    createReviewResponse(reviewId, responseContent);

    await revalidateReviewsCache();

    await use({
      reviewId,
      productId: product.id,
      productHandle: product.handle,
      responseContent,
    });

    cleanupReview(reviewId);
  },
});

export { expect };
