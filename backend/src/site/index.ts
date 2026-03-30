export type SiteModuleRegistration = {
  options?: Record<string, unknown>;
  resolve: string;
};

/**
 * Reserve this list for site-only Medusa modules added in a fork.
 * Keep template modules registered directly in `backend/medusa-config.ts`.
 */
export const siteModules: SiteModuleRegistration[] = [];
