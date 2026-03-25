/**
 * Email Brand Configuration
 *
 * This configuration is used across all email templates to maintain
 * consistent branding. Override these values when sending emails
 * by passing a partial config to the template.
 */

export interface EmailBrandConfig {
  companyName: string;
  logoUrl: string;
  logoAlt?: string;
  supportEmail: string;
  websiteUrl: string;
  appUrl?: string;
  address?: string;
  copyrightYear?: number;
  socialLinks?: {
    twitter?: string;
    facebook?: string;
    instagram?: string;
    linkedin?: string;
    github?: string;
  };
  legalLinks?: {
    terms?: string;
    privacy?: string;
    unsubscribe?: string;
    preferences?: string;
    cookies?: string;
    contact?: string;
  };
  navLinks?: Array<{ label: string; href: string }>;
}

export const defaultEmailConfig: EmailBrandConfig = {
  companyName: "CrowCommerce",
  logoUrl: "",
  logoAlt: "CrowCommerce",
  supportEmail: "support@crowcommerce.org",
  websiteUrl: "https://crowcommerce.org",
  appUrl: "https://crowcommerce.org/account",
  address: "",
  copyrightYear: new Date().getFullYear(),
  socialLinks: {
    twitter: "https://x.com/crowcommerce",
  },
  legalLinks: {
    terms: "https://crowcommerce.org/terms",
    privacy: "https://crowcommerce.org/privacy",
  },
};

export function getEmailConfig(
  overrides?: Partial<EmailBrandConfig>,
): EmailBrandConfig {
  return {
    ...defaultEmailConfig,
    ...overrides,
    socialLinks: {
      ...defaultEmailConfig.socialLinks,
      ...overrides?.socialLinks,
    },
    legalLinks: {
      ...defaultEmailConfig.legalLinks,
      ...overrides?.legalLinks,
    },
  };
}
