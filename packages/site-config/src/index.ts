import { siteBrand } from "./brand";
import { siteFeatures } from "./features";
import { siteIntegrations } from "./integrations";
import { siteNavigation } from "./navigation";

export { siteBrand } from "./brand";
export { siteFeatures } from "./features";
export { siteIntegrations } from "./integrations";
export { siteNavigation } from "./navigation";

export const siteConfig = {
  brand: siteBrand,
  features: siteFeatures,
  integrations: siteIntegrations,
  navigation: siteNavigation,
} as const;
