export type SiteNavigationLink = {
  href: string;
  name: string;
};

export type SiteNavigationConfig = {
  pages: SiteNavigationLink[];
  utility: SiteNavigationLink[];
};

export const siteNavigation: SiteNavigationConfig = {
  pages: [
    // Template placeholders; downstream sites can replace these with real routes.
    { href: "/search", name: "Company" },
    { href: "/search", name: "Stores" },
  ],
  utility: [
    { href: "/account", name: "Account" },
    { href: "/support", name: "Support" },
  ],
};
