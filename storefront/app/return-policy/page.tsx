import type { Metadata } from "next";
import { PolicyPage } from "components/legal/policy-page";
import { RETURN_POLICY } from "lib/constants/legal-content";

export const metadata: Metadata = {
  title: "Return Policy",
  description: "Understand our return and refund process.",
  robots: { index: true },
};

export default function ReturnPolicyPage() {
  return <PolicyPage {...RETURN_POLICY} />;
}
