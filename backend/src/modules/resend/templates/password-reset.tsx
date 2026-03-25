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

export interface PasswordResetProps extends BaseTemplateProps {
  resetUrl: string;
  email: string;
  actorType: "customer" | "user";
}

export function isValidPasswordResetData(
  data: unknown,
): data is PasswordResetProps {
  const d = data as Record<string, any>;
  return (
    typeof d?.resetUrl === "string" &&
    typeof d?.email === "string" &&
    (d?.actorType === "customer" || d?.actorType === "user")
  );
}

export const PasswordReset = ({
  theme,
  resetUrl,
  email,
  actorType,
  brandConfig,
}: PasswordResetProps) => {
  const config = getEmailConfig(brandConfig);
  const isAdmin = actorType === "user";

  return (
    <Html>
      <Tailwind theme={theme}>
        <Head />
        <Preview>Reset your {isAdmin ? "admin" : "account"} password</Preview>
        <Body>
          <Container
            align="center"
            className="w-full max-w-160 bg-primary md:p-8"
          >
            <Header logoUrl={config.logoUrl} logoAlt={config.logoAlt} />
            <Section align="left" className="max-w-full px-6 py-8">
              <Row className="mb-6">
                <Text className="text-display-xs font-semibold text-primary">
                  Reset Your Password
                </Text>
              </Row>
              <Row className="mb-6">
                <Text className="text-tertiary">
                  We received a request to reset the password for the{" "}
                  {isAdmin ? "admin" : "store"} account associated with {email}.
                  Click the button below to choose a new password.
                </Text>
              </Row>
              <Row className="mb-6">
                <Button href={resetUrl}>
                  <Text className="text-md font-semibold">Reset Password</Text>
                </Button>
              </Row>
              <Row className="mb-6">
                <Text className="text-sm text-tertiary">
                  This link expires in 15 minutes. If you didn't request a
                  password reset, you can safely ignore this email — your
                  password will remain unchanged.
                </Text>
              </Row>
              <Row>
                <Text className="text-md text-tertiary">
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

PasswordReset.PreviewProps = {
  resetUrl:
    "http://localhost:3000/reset-password?token=abc123&email=sarah@example.com",
  email: "sarah@example.com",
  actorType: "customer",
} satisfies PasswordResetProps;

export default PasswordReset;
