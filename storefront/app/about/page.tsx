// storefront/app/about/page.tsx
import type { Metadata } from "next";
import { AboutHero } from "components/about/about-hero";
import { AboutMission } from "components/about/about-mission";
import { AboutValues } from "components/about/about-values";
import { AboutTeam } from "components/about/about-team";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Learn about our mission, values, and the team behind CrowCommerce.",
  alternates: {
    canonical: "/about",
  },
};

export default function AboutPage() {
  return (
    <main className="isolate">
      <AboutHero />
      <AboutMission />
      <AboutValues />
      <AboutTeam />
      <div className="mt-32 sm:mt-48" />
    </main>
  );
}
