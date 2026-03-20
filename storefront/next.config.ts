import { withSentryConfig } from "@sentry/nextjs"

export default withSentryConfig(
  {
    cacheComponents: true,
    reactCompiler: true,
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
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    silent: !process.env.CI,
  }
)
