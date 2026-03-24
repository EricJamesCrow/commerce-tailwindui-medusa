type FooterLink = { name: string; href: string };

type FooterConfig = {
  company: FooterLink[];
  legal: FooterLink[];
};

export const FOOTER_CONFIG: FooterConfig = {
  company: [
    { name: "About", href: "/about" },
    { name: "Contact", href: "/contact" },
    { name: "FAQ", href: "/faq" },
  ],
  legal: [
    { name: "Privacy Policy", href: "/privacy-policy" },
    { name: "Terms of Service", href: "/terms-of-service" },
    { name: "Return Policy", href: "/return-policy" },
    { name: "Shipping Policy", href: "/shipping-policy" },
    { name: "Cookie Policy", href: "/cookie-policy" },
  ],
};
