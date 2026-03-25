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

export interface NewsletterWelcomeProps extends BaseTemplateProps {
  email: string;
  unsubscribeUrl: string;
}

export function isValidNewsletterWelcomeData(
  data: unknown,
): data is NewsletterWelcomeProps {
  const d = data as Record<string, any>;
  return typeof d?.email === "string" && typeof d?.unsubscribeUrl === "string";
}

export const NewsletterWelcome = ({
  theme,
  email,
  unsubscribeUrl,
  brandConfig,
}: NewsletterWelcomeProps) => {
  const config = getEmailConfig({
    ...brandConfig,
    legalLinks: {
      ...brandConfig?.legalLinks,
      unsubscribe: unsubscribeUrl,
    },
  });

  return (
    <Html>
      <Tailwind theme={theme}>
        <Head />
        <Preview>Welcome to the {config.companyName} newsletter</Preview>
        <Body>
          <Container
            align="center"
            className="w-full max-w-160 bg-primary md:p-8"
          >
            <Header logoUrl={config.logoUrl} logoAlt={config.logoAlt} />
            <Section align="left" className="max-w-full px-6 py-8">
              <Row className="mb-6">
                <Text className="text-display-xs font-semibold text-primary">
                  Welcome to Our Newsletter
                </Text>
              </Row>
              <Row className="mb-6">
                <Text className="text-tertiary">
                  Thanks for subscribing! We'll send you the latest deals and
                  savings weekly.
                </Text>
              </Row>
              <Row className="mb-6">
                <Button href={config.websiteUrl}>
                  <Text className="text-md font-semibold">Start Shopping</Text>
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
              recipientEmail={email}
            />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

NewsletterWelcome.PreviewProps = {
  email: "subscriber@example.com",
  unsubscribeUrl: "http://localhost:3000/newsletter/unsubscribe?token=test",
} satisfies NewsletterWelcomeProps;

export default NewsletterWelcome;
