import type { Metadata } from "next";
import { PolicyPage } from "components/legal/policy-page";
import { TERMS_OF_SERVICE } from "lib/constants/legal-content";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Read the terms and conditions for using our store.",
  robots: { index: true },
};

export default function TermsOfServicePage() {
  return <PolicyPage {...TERMS_OF_SERVICE} />;
}
