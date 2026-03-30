import {
  Container,
  Hr,
  Html,
  Preview,
  Row,
  Section,
} from "@react-email/components";
import { Body } from "./_components/body";
import { LeftAligned as Footer } from "./_components/footer";
import { Head } from "./_components/head";
import { LeftAligned as Header } from "./_components/header";
import { Tailwind } from "./_components/tailwind";
import { Text } from "./_components/text";
import { getEmailConfig } from "./_config/email-config";
import type { BaseTemplateProps } from "./types";

export interface ContactFormMessageProps extends BaseTemplateProps {
  submitterName: string;
  submitterEmail: string;
  subjectLine: string;
  message: string;
  submittedAt: string;
}

export function isValidContactFormMessageData(
  data: unknown,
): data is ContactFormMessageProps {
  const candidate = data as Record<string, unknown>;

  return (
    typeof candidate?.submitterName === "string" &&
    typeof candidate?.submitterEmail === "string" &&
    typeof candidate?.subjectLine === "string" &&
    typeof candidate?.message === "string" &&
    typeof candidate?.submittedAt === "string"
  );
}

export function ContactFormMessage({
  theme,
  submitterName,
  submitterEmail,
  subjectLine,
  message,
  submittedAt,
  brandConfig,
}: ContactFormMessageProps) {
  const config = getEmailConfig(brandConfig);

  return (
    <Html>
      <Tailwind theme={theme}>
        <Head />
        <Preview>New contact form message from {submitterName}</Preview>
        <Body>
          <Container
            align="center"
            className="w-full max-w-160 bg-primary md:p-8"
          >
            <Header logoUrl={config.logoUrl} logoAlt={config.logoAlt} />
            <Section align="left" className="max-w-full px-6 py-8">
              <Row className="mb-6">
                <Text className="text-display-xs font-semibold text-primary">
                  New Contact Request
                </Text>
              </Row>
              <Row className="mb-4">
                <Text className="text-tertiary">
                  {submitterName} submitted the contact form on {submittedAt}.
                </Text>
              </Row>
              <Row className="mb-2">
                <Text className="text-sm font-semibold text-primary">From</Text>
              </Row>
              <Row className="mb-4">
                <Text className="text-tertiary">
                  {submitterName}
                  <br />
                  {submitterEmail}
                </Text>
              </Row>
              <Row className="mb-2">
                <Text className="text-sm font-semibold text-primary">
                  Subject
                </Text>
              </Row>
              <Row className="mb-4">
                <Text className="text-tertiary">{subjectLine}</Text>
              </Row>
              <Hr className="border-neutral-200" />
              <Row className="mb-2 mt-4">
                <Text className="text-sm font-semibold text-primary">
                  Message
                </Text>
              </Row>
              <Row>
                <Text className="whitespace-pre-wrap text-tertiary">
                  {message}
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
}

ContactFormMessage.PreviewProps = {
  submitterName: "Casey Rivera",
  submitterEmail: "casey@example.com",
  subjectLine: "Wholesale question",
  message:
    "Hi team,\n\nI want to understand your wholesale minimums for a spring launch.\n\nThanks.",
  submittedAt: "2026-03-30 10:15 UTC",
} satisfies ContactFormMessageProps;

export default ContactFormMessage;
