import type { MedusaContainer } from "@medusajs/framework/types"

/**
 * Strip trailing slash from a URL string.
 */
function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, "")
}

/**
 * Resolve the storefront base URL from STOREFRONT_URL env var.
 * Returns null if not configured.
 */
export function resolveStorefrontUrl(): string | null {
  const raw = process.env.STOREFRONT_URL
  if (!raw) return null
  return stripTrailingSlash(raw)
}

/**
 * Resolve the admin base URL (e.g. "http://localhost:9000/app")
 * from configModule's admin settings.
 * Returns null if backendUrl is not configured.
 */
export function resolveAdminUrl(container: MedusaContainer): string | null {
  const configModule = container.resolve("configModule")
  const rawBackendUrl = configModule.admin?.backendUrl

  if (!rawBackendUrl || rawBackendUrl === "/") return null

  const backendUrl = stripTrailingSlash(rawBackendUrl)
  const adminPath = configModule.admin?.path || "/app"

  return `${backendUrl}${adminPath}`
}
