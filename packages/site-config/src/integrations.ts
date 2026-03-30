export type SiteIntegrationConfig = {
  meilisearchProductIndexName: string | null;
  posthogProjectHint: string | null;
};

export const siteIntegrations: SiteIntegrationConfig = {
  meilisearchProductIndexName: null,
  posthogProjectHint: null,
};
