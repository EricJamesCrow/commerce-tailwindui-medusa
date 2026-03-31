import type { Metadata } from "next";
import { PolicyPage } from "components/legal/policy-page";
import { SHIPPING_POLICY } from "lib/constants/legal-content";

export const metadata: Metadata = {
  title: "Shipping Policy",
  description:
    "Learn about our shipping methods, rates, and delivery timeframes.",
  robots: { index: true },
};

export default function ShippingPolicyPage() {
  return <PolicyPage {...SHIPPING_POLICY} />;
}
