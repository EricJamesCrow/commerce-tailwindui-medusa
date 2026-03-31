import type { Metadata } from "next";
import { PolicyPage } from "components/legal/policy-page";
import { COOKIE_POLICY } from "lib/constants/legal-content";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "Learn how we use cookies and similar tracking technologies.",
  robots: { index: true },
};

export default function CookiePolicyPage() {
  return <PolicyPage {...COOKIE_POLICY} />;
}
