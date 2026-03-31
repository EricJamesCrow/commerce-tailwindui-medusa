import { withSentryConfig } from "@sentry/nextjs";
import { getStorefrontSentryBuildConfig } from "./lib/sentry";

const sentryBuildConfig = getStorefrontSentryBuildConfig();

function sanitizeEnvUrl(value: string | undefined, fallback = ""): string {
  return value?.replace(/[\r\n]+/g, "").trim() || fallback;
}

function getCspOrigin(value: string | undefined, fallback?: string): string {
  const sanitized = sanitizeEnvUrl(value, fallback ?? "");

  if (!sanitized) {
    return "";
  }

  try {
    return new URL(sanitized).origin;
  } catch {
    return "";
  }
}

function joinCspSources(sources: Array<string | false | undefined>): string {
  return [...new Set(sources.filter(Boolean))].join(" ");
}

function buildContentSecurityPolicy(): string {
  const isDev = process.env.NODE_ENV !== "production";
  const backendOrigin = getCspOrigin(
    process.env.MEDUSA_BACKEND_URL,
    isDev ? "http://localhost:9000" : "",
  );
  const meilisearchOrigin = getCspOrigin(
    process.env.NEXT_PUBLIC_MEILISEARCH_HOST,
  );
  const posthogOrigin = getCspOrigin(process.env.NEXT_PUBLIC_POSTHOG_HOST);

  if (!isDev && !backendOrigin) {
    console.warn(
      "[next.config] MEDUSA_BACKEND_URL is not set - CSP will block backend requests",
    );
  }

  const scriptSrc = joinCspSources([
    "'self'",
    "'unsafe-inline'",
    "https://js.stripe.com",
    "https://*.js.stripe.com",
    isDev && "'unsafe-eval'",
  ]);

  const connectSrc = joinCspSources([
    "'self'",
    backendOrigin,
    posthogOrigin,
    meilisearchOrigin,
    "https://*.sentry.io",
    "https://sentry.io",
    "https://*.stripe.com",
    "https://m.stripe.com",
    isDev && "ws:",
    isDev && "wss:",
  ]);

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://*.stripe.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "media-src 'self' blob: https:",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

const contentSecurityPolicy = buildContentSecurityPolicy();

export default withSentryConfig(
  {
    cacheComponents: true,
    reactCompiler: true,
    skipTrailingSlashRedirect: true,
    transpilePackages: ["@repo/site-config"],
    async headers() {
      return [
        {
          source: "/:path*",
          headers: [
            {
              key: "Strict-Transport-Security",
              value: "max-age=63072000; includeSubDomains; preload",
            },
            { key: "X-Frame-Options", value: "DENY" },
            { key: "X-Content-Type-Options", value: "nosniff" },
            {
              // Keeps cross-site origin attribution available for ads/analytics
              // without exposing full-path referrers off-origin.
              key: "Referrer-Policy",
              value: "origin-when-cross-origin",
            },
            {
              key: "Permissions-Policy",
              value:
                "camera=(), microphone=(), geolocation=(), interest-cohort=()",
            },
            { key: "X-DNS-Prefetch-Control", value: "on" },
            {
              key: "Content-Security-Policy",
              value: contentSecurityPolicy,
            },
          ],
        },
      ];
    },
    async rewrites() {
      return [
        {
          source: "/api/ph/static/:path*",
          destination: "https://us-assets.i.posthog.com/static/:path*",
        },
        {
          source: "/api/ph/:path*",
          destination: "https://us.i.posthog.com/:path*",
        },
      ];
    },
    experimental: {
      serverActions: {
        bodySizeLimit: "15mb",
      },
    },
    images: {
      formats: ["image/avif", "image/webp"],
      remotePatterns: [
        {
          protocol: "http",
          hostname: "localhost",
        },
        {
          protocol: "https",
          hostname: "medusa-public-images.s3.eu-west-1.amazonaws.com",
        },
        {
          protocol: "https",
          hostname: "medusa-server-testing.s3.amazonaws.com",
        },
        {
          protocol: "https",
          hostname: "via.placeholder.com",
        },
        {
          protocol: "https",
          hostname: "tailwindcss.com",
          pathname: "/plus-assets/**",
        },
        {
          protocol: "https",
          hostname: "images.unsplash.com",
        },
        ...(process.env.S3_IMAGE_HOSTNAME
          ? [
              {
                protocol: "https" as const,
                hostname: process.env.S3_IMAGE_HOSTNAME,
              },
            ]
          : []),
        ...(process.env.NODE_ENV !== "production"
          ? [{ protocol: "https" as const, hostname: "placehold.co" }]
          : []),
      ],
    },
  },
  {
    authToken: sentryBuildConfig.authToken,
    org: sentryBuildConfig.org,
    project: sentryBuildConfig.project,
    silent: !process.env.CI,
  },
);
