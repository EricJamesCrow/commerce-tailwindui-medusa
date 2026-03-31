import { NextResponse } from "next/server";
import { sanitizeEnvValue } from "lib/env";
import { resolveStorefrontSentryEnvironment } from "lib/sentry";

export function GET(): NextResponse {
  return NextResponse.json(
    {
      status: "ok",
      service: "storefront",
      environment: resolveStorefrontSentryEnvironment(),
      vercelEnv: sanitizeEnvValue(process.env.VERCEL_ENV) ?? null,
      commitSha: sanitizeEnvValue(process.env.VERCEL_GIT_COMMIT_SHA) ?? null,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}
