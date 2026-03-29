import type { MedusaContainer } from "@medusajs/framework/types";

/**
 * Strip trailing slash from a URL string.
 */
function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function sanitizeUrlValue(url: string | null | undefined): string | null {
  const sanitized = url?.replace(/[\r\n]+/g, "").trim();
  if (!sanitized) {
    return null;
  }

  return stripTrailingSlash(sanitized);
}

/**
 * Resolve the storefront base URL from STOREFRONT_URL env var.
 * Returns null if not configured.
 */
export function resolveStorefrontUrl(): string | null {
  return sanitizeUrlValue(process.env.STOREFRONT_URL);
}

/**
 * Resolve the admin base URL (e.g. "http://localhost:9000/app")
 * from configModule's admin settings.
 * Returns null if backendUrl is not configured.
 */
export function resolveAdminUrl(container: MedusaContainer): string | null {
  const configModule = container.resolve("configModule");
  const rawBackendUrl = configModule.admin?.backendUrl;

  if (!rawBackendUrl || rawBackendUrl === "/") return null;

  const backendUrl = sanitizeUrlValue(rawBackendUrl);
  if (!backendUrl) {
    return null;
  }
  const adminPath = configModule.admin?.path || "/app";

  return `${backendUrl}${adminPath}`;
}
