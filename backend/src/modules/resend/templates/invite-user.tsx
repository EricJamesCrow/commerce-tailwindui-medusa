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

export interface InviteUserProps extends BaseTemplateProps {
  inviteUrl: string;
  storeName: string;
}

export function isValidInviteUserData(data: unknown): data is InviteUserProps {
  const d = data as Record<string, any>;
  return typeof d?.inviteUrl === "string" && typeof d?.storeName === "string";
}

export const InviteUser = ({
  theme,
  inviteUrl,
  storeName,
  brandConfig,
}: InviteUserProps) => {
  const config = getEmailConfig(brandConfig);

  return (
    <Html>
      <Tailwind theme={theme}>
        <Head />
        <Preview>You've been invited to join {storeName}</Preview>
        <Body>
          <Container
            align="center"
            className="w-full max-w-160 bg-primary md:p-8"
          >
            <Header logoUrl={config.logoUrl} logoAlt={config.logoAlt} />
            <Section align="left" className="max-w-full px-6 py-8">
              <Row className="mb-6">
                <Text className="text-display-xs font-semibold text-primary">
                  You've Been Invited
                </Text>
              </Row>
              <Row className="mb-6">
                <Text className="text-tertiary">
                  You've been invited to join {storeName} as an admin. Click the
                  button below to accept your invitation and set up your
                  account.
                </Text>
              </Row>
              <Row className="mb-6">
                <Button href={inviteUrl}>
                  <Text className="text-md font-semibold">Accept Invite</Text>
                </Button>
              </Row>
              <Row className="mb-6">
                <Text className="text-sm text-tertiary">
                  This invitation expires in 7 days. If you weren't expecting
                  this invitation, you can safely ignore this email.
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

InviteUser.PreviewProps = {
  inviteUrl: "http://localhost:9000/app/invite?token=abc123",
  storeName: "CrowCommerce",
} satisfies InviteUserProps;

export default InviteUser;
