import type { MedusaContainer } from "@medusajs/framework/types";
import * as Sentry from "@sentry/node";
import { resolveStorefrontUrl } from "./resolve-urls";

const REVALIDATE_PATH = "/api/revalidate";
const REQUEST_TIMEOUT_MS = 10_000;

let warnedMissingStorefrontUrl = false;
let warnedMissingRevalidateSecret = false;

function sanitizeEnvValue(value: string | undefined): string | null {
  const sanitized = value?.replace(/[\r\n]+/g, "").trim();
  return sanitized ? sanitized : null;
}

function resolveRevalidateSecret(): string | null {
  return sanitizeEnvValue(process.env.REVALIDATE_SECRET);
}

function resolveRevalidateUrl(): string | null {
  const storefrontUrl = sanitizeEnvValue(resolveStorefrontUrl() ?? undefined);
  return storefrontUrl ? `${storefrontUrl}${REVALIDATE_PATH}` : null;
}

export async function triggerStorefrontCatalogRevalidation({
  container,
  resourceId,
  resourceType,
}: {
  container: MedusaContainer;
  resourceId: string;
  resourceType: "product" | "collection";
}): Promise<boolean> {
  const logger = container.resolve("logger");
  const revalidateUrl = resolveRevalidateUrl();
  const secret = resolveRevalidateSecret();

  if (!revalidateUrl) {
    if (!warnedMissingStorefrontUrl) {
      warnedMissingStorefrontUrl = true;
      logger.warn(
        "[StorefrontRevalidate] STOREFRONT_URL is not configured — skipping automatic catalog revalidation",
      );
    }
    return false;
  }

  if (!secret) {
    if (!warnedMissingRevalidateSecret) {
      warnedMissingRevalidateSecret = true;
      logger.warn(
        "[StorefrontRevalidate] REVALIDATE_SECRET is not configured — skipping automatic catalog revalidation",
      );
    }
    return false;
  }

  try {
    const response = await fetch(revalidateUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-revalidate-secret": secret,
      },
      body: JSON.stringify({
        source: "medusa-subscriber",
        scope: "catalog",
        resource_id: resourceId,
        resource_type: resourceType,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Storefront revalidate returned ${response.status}: ${body.slice(0, 200)}`,
      );
    }

    logger.info(
      `[StorefrontRevalidate] Revalidated ${resourceType} cache for ${resourceId}`,
    );

    return true;
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        subscriber: "storefront_catalog_revalidate",
        resource_id: resourceId,
        resource_type: resourceType,
      },
      level: "warning",
    });

    logger.warn(
      `[StorefrontRevalidate] Failed to revalidate ${resourceType} cache for ${resourceId}: ${error}`,
    );

    return false;
  }
}
