import { loadEnv, defineConfig } from "@medusajs/framework/utils";

loadEnv(process.env.NODE_ENV || "development", process.cwd());

const isProd = process.env.NODE_ENV === "production";
const INSECURE_SECRETS = ["supersecret", "change-me-to-a-secure-random-string"];
const storefrontUrl = process.env.STOREFRONT_URL?.trim();
const revalidateSecret = process.env.REVALIDATE_SECRET?.trim();

if (
  isProd &&
  (!process.env.JWT_SECRET || INSECURE_SECRETS.includes(process.env.JWT_SECRET))
) {
  throw new Error("JWT_SECRET must be set to a secure value in production");
}
if (
  isProd &&
  (!process.env.COOKIE_SECRET ||
    INSECURE_SECRETS.includes(process.env.COOKIE_SECRET))
) {
  throw new Error("COOKIE_SECRET must be set to a secure value in production");
}
if (
  isProd &&
  process.env.STRIPE_API_KEY &&
  !process.env.STRIPE_WEBHOOK_SECRET
) {
  throw new Error(
    "STRIPE_WEBHOOK_SECRET must be set when Stripe is enabled in production",
  );
}

if (!isProd) {
  if (
    !process.env.JWT_SECRET ||
    INSECURE_SECRETS.includes(process.env.JWT_SECRET)
  ) {
    console.warn(
      "[medusa-config] JWT_SECRET is using default value — set a secure secret before deploying",
    );
  }
  if (
    !process.env.COOKIE_SECRET ||
    INSECURE_SECRETS.includes(process.env.COOKIE_SECRET)
  ) {
    console.warn(
      "[medusa-config] COOKIE_SECRET is using default value — set a secure secret before deploying",
    );
  }
}

const redisUrl = process.env.REDIS_URL;

if (!process.env.STRIPE_API_KEY) {
  console.warn(
    "[medusa-config] STRIPE_API_KEY is not set — Stripe payments will not work",
  );
}

if (process.env.STRIPE_API_KEY && !process.env.STRIPE_WEBHOOK_SECRET) {
  console.warn(
    "[medusa-config] STRIPE_WEBHOOK_SECRET is not set — Stripe webhooks will not be verified. " +
      "Set STRIPE_WEBHOOK_SECRET before going live.",
  );
}

if (
  process.env.S3_BUCKET &&
  (!process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY)
) {
  console.warn(
    "[medusa-config] S3_BUCKET is set but S3_ACCESS_KEY_ID or S3_SECRET_ACCESS_KEY is missing — " +
      "file uploads will fail",
  );
}

if (!process.env.POSTHOG_EVENTS_API_KEY) {
  console.warn(
    "[medusa-config] POSTHOG_EVENTS_API_KEY is not set — backend analytics will be disabled",
  );
}

if (process.env.MEILISEARCH_HOST && !process.env.MEILISEARCH_API_KEY) {
  if (isProd) {
    throw new Error(
      "[medusa-config] MEILISEARCH_HOST is set but MEILISEARCH_API_KEY is missing — " +
        "refusing to start in production",
    );
  }
  console.warn(
    "[medusa-config] MEILISEARCH_HOST is set but MEILISEARCH_API_KEY is missing — " +
      "Meilisearch module will not be registered",
  );
}

if (storefrontUrl && !revalidateSecret) {
  console.warn(
    "[medusa-config] STOREFRONT_URL is set but REVALIDATE_SECRET is missing — " +
      "catalog updates will not trigger storefront cache revalidation",
  );
}

if (revalidateSecret && !storefrontUrl) {
  console.warn(
    "[medusa-config] REVALIDATE_SECRET is set but STOREFRONT_URL is missing — " +
      "catalog updates will not trigger storefront cache revalidation",
  );
}

module.exports = defineConfig({
  admin: {
    backendUrl: process.env.MEDUSA_BACKEND_URL,
  },
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },
  },
  modules: [
    {
      resolve: "./src/modules/product-review",
    },
    {
      resolve: "./src/modules/wishlist",
    },
    {
      resolve: "./src/modules/invoice",
    },
    {
      resolve: "./src/modules/newsletter",
    },
    // S3 file provider for persistent storage (conditional on S3_BUCKET)
    ...(process.env.S3_BUCKET
      ? [
          {
            resolve: "@medusajs/medusa/file",
            options: {
              providers: [
                {
                  resolve: "@medusajs/medusa/file-s3",
                  id: "s3",
                  options: {
                    file_url: process.env.S3_FILE_URL,
                    access_key_id: process.env.S3_ACCESS_KEY_ID,
                    secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
                    region: process.env.S3_REGION,
                    bucket: process.env.S3_BUCKET,
                    endpoint: process.env.S3_ENDPOINT,
                    additional_client_config: {
                      forcePathStyle: true,
                    },
                  },
                },
              ],
            },
          },
        ]
      : []),
    // Resend email notification provider (conditional on RESEND_API_KEY)
    ...(process.env.RESEND_API_KEY
      ? [
          {
            resolve: "@medusajs/medusa/notification",
            options: {
              providers: [
                {
                  resolve: "./src/modules/resend",
                  id: "resend",
                  options: {
                    channels: ["email"],
                    api_key: process.env.RESEND_API_KEY,
                    from:
                      process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
                  },
                },
              ],
            },
          },
        ]
      : []),
    // Stripe payment provider (conditional on STRIPE_API_KEY)
    ...(process.env.STRIPE_API_KEY
      ? [
          {
            resolve: "@medusajs/medusa/payment",
            options: {
              providers: [
                {
                  resolve: "@medusajs/medusa/payment-stripe",
                  id: "stripe",
                  options: {
                    apiKey: process.env.STRIPE_API_KEY,
                    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
                    capture: false,
                    automatic_payment_methods: true,
                  },
                },
              ],
            },
          },
        ]
      : []),
    // Redis-backed production modules (conditional on REDIS_URL)
    ...(redisUrl
      ? [
          {
            resolve: "@medusajs/medusa/caching",
            options: {
              providers: [
                {
                  resolve: "@medusajs/caching-redis",
                  id: "caching-redis",
                  is_default: true,
                  options: {
                    redisUrl,
                  },
                },
              ],
            },
          },
          {
            resolve: "@medusajs/medusa/event-bus-redis",
            options: {
              redisUrl,
            },
          },
          {
            resolve: "@medusajs/medusa/workflow-engine-redis",
            options: {
              redis: {
                redisUrl,
              },
            },
          },
          {
            resolve: "@medusajs/medusa/locking",
            options: {
              providers: [
                {
                  resolve: "@medusajs/medusa/locking-redis",
                  id: "locking-redis",
                  is_default: true,
                  options: {
                    redisUrl,
                  },
                },
              ],
            },
          },
        ]
      : []),
    // PostHog analytics (conditional on POSTHOG_EVENTS_API_KEY)
    ...(process.env.POSTHOG_EVENTS_API_KEY
      ? [
          {
            resolve: "@medusajs/medusa/analytics",
            options: {
              providers: [
                {
                  resolve: "@medusajs/analytics-posthog",
                  id: "posthog",
                  options: {
                    posthogEventsKey: process.env.POSTHOG_EVENTS_API_KEY,
                    posthogHost: process.env.POSTHOG_HOST,
                  },
                },
              ],
            },
          },
        ]
      : []),
    // Meilisearch search indexing (conditional on MEILISEARCH_HOST + API_KEY)
    ...(process.env.MEILISEARCH_HOST && process.env.MEILISEARCH_API_KEY
      ? [
          {
            resolve: "./src/modules/meilisearch",
            options: {
              host: process.env.MEILISEARCH_HOST,
              apiKey: process.env.MEILISEARCH_API_KEY,
              productIndexName:
                process.env.MEILISEARCH_PRODUCT_INDEX_NAME || "products",
            },
          },
        ]
      : []),
  ],
});
