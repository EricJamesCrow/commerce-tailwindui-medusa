import {
  Container,
  Html,
  Preview,
  Row,
  Section,
} from "@react-email/components";
import { Body } from "./_components/body";
import { Button } from "./_components/button";
import { LeftAligned as Footer } from "./_components/footer";
import { Head } from "./_components/head";
import { LeftAligned as Header } from "./_components/header";
import { Tailwind } from "./_components/tailwind";
import { Text } from "./_components/text";
import { getEmailConfig } from "./_config/email-config";
import type { BaseTemplateProps } from "./types";

export interface WelcomeProps extends BaseTemplateProps {
  customerName: string | null;
  shopUrl: string;
  accountUrl: string;
  storeName: string;
}

export function isValidWelcomeData(data: unknown): data is WelcomeProps {
  const d = data as Record<string, any>;
  return (
    typeof d?.shopUrl === "string" &&
    typeof d?.accountUrl === "string" &&
    typeof d?.storeName === "string"
  );
}

export const Welcome = ({
  theme,
  customerName,
  shopUrl,
  accountUrl,
  storeName,
  brandConfig,
}: WelcomeProps) => {
  const config = getEmailConfig(brandConfig);
  const greeting = customerName ? `Hi ${customerName},` : "Hi there,";

  return (
    <Html>
      <Tailwind theme={theme}>
        <Head />
        <Preview>Welcome to {storeName}</Preview>
        <Body>
          <Container
            align="center"
            className="w-full max-w-160 bg-primary md:p-8"
          >
            <Header logoUrl={config.logoUrl} logoAlt={config.logoAlt} />
            <Section align="left" className="max-w-full px-6 py-8">
              <Row className="mb-6">
                <Text className="text-display-xs font-semibold text-primary">
                  Welcome to {storeName}
                </Text>
              </Row>
              <Row className="mb-6">
                <Text className="text-tertiary">
                  {greeting}
                  <br />
                  <br />
                  Thanks for creating an account! We're excited to have you.
                  Here's what you can do:
                </Text>
              </Row>
              <Row className="mb-2">
                <Text className="text-tertiary">
                  • Browse our latest collections and discover new arrivals
                </Text>
              </Row>
              <Row className="mb-2">
                <Text className="text-tertiary">
                  • Save your favorites to your wishlist for later
                </Text>
              </Row>
              <Row className="mb-6">
                <Text className="text-tertiary">
                  • Track your orders and manage your account in one place
                </Text>
              </Row>
              <Row className="mb-4">
                <Button href={shopUrl}>
                  <Text className="text-md font-semibold">Start Shopping</Text>
                </Button>
              </Row>
              <Row className="mb-6">
                <Button href={accountUrl} color="secondary">
                  <Text className="text-md font-semibold">
                    View Your Account
                  </Text>
                </Button>
              </Row>
              <Row>
                <Text className="text-md text-tertiary">
                  If you have any questions, contact us at{" "}
                  <a
                    href={`mailto:${config.supportEmail}`}
                    className="text-brand-secondary"
                  >
                    {config.supportEmail}
                  </a>
                  .
                  <br />
                  <br />
                  Thanks,
                  <br />
                  The {config.companyName} team
                </Text>
              </Row>
            </Section>
            <Footer
              companyName={config.companyName}
              copyrightYear={config.copyrightYear}
              legalLinks={config.legalLinks}
            />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

Welcome.PreviewProps = {
  customerName: "Sarah",
  shopUrl: "http://localhost:3000",
  accountUrl: "http://localhost:3000/account",
  storeName: "CrowCommerce",
} satisfies WelcomeProps;

export default Welcome;
