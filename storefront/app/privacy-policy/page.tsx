import type { Metadata } from "next";
import { PolicyPage } from "components/legal/policy-page";
import { PRIVACY_POLICY } from "lib/constants/legal-content";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Learn how we collect, use, and protect your personal information.",
  robots: { index: true },
};

export default function PrivacyPolicyPage() {
  return <PolicyPage {...PRIVACY_POLICY} />;
}
