import {
  Column,
  Container,
  Button as EmailButton,
  Hr,
  Img,
  Row,
  Text as EmailText,
} from "@react-email/components";
import { Text } from "./text";
import {
  defaultEmailConfig,
  type EmailBrandConfig,
} from "../_config/email-config";

// TODO: self-host social icons — currently using UntitledUI CDN URLs

/**
 * Renders the logo as an image if a URL is provided, otherwise falls back to
 * a styled text wordmark using the companyName.
 */
const Logo = ({
  logoUrl,
  logoAlt,
  companyName,
  className,
}: {
  logoUrl: string;
  logoAlt: string;
  companyName?: string;
  className?: string;
}) => {
  if (logoUrl) {
    return (
      <Img
        aria-hidden
        src={logoUrl}
        alt={logoAlt}
        className={className || "h-6"}
      />
    );
  }
  return (
    <EmailText
      style={{
        fontSize: "16px",
        fontWeight: 700,
        lineHeight: "24px",
        margin: 0,
        color: "#111827",
      }}
    >
      {companyName || "CrowCommerce"}
    </EmailText>
  );
};

/**
 * Props interface for configurable footer components
 */
export interface FooterProps {
  /** Company name */
  companyName?: string;
  /** Recipient email (for "sent to" text) */
  recipientEmail?: string;
  /** Logo URL */
  logoUrl?: string;
  /** Logo alt text */
  logoAlt?: string;
  /** Copyright year */
  copyrightYear?: number;
  /** Physical address */
  address?: string;
  /** Social media links */
  socialLinks?: {
    twitter?: string;
    facebook?: string;
    instagram?: string;
  };
  /** Legal links */
  legalLinks?: {
    unsubscribe?: string;
    preferences?: string;
    terms?: string;
    privacy?: string;
    cookies?: string;
    contact?: string;
  };
  /** App store links */
  appLinks?: {
    appStore?: string;
    googlePlay?: string;
  };
  /** Custom message (e.g., sustainability note) */
  customMessage?: string;
}

export const LeftAligned = ({
  companyName = defaultEmailConfig.companyName,
  recipientEmail,
  logoUrl = defaultEmailConfig.logoUrl,
  logoAlt = defaultEmailConfig.logoAlt || "CrowCommerce",
  copyrightYear = defaultEmailConfig.copyrightYear,
  address = defaultEmailConfig.address,
  socialLinks = defaultEmailConfig.socialLinks,
  legalLinks = defaultEmailConfig.legalLinks,
}: FooterProps = {}) => {
  return (
    <Container align="left" className="max-w-full bg-primary p-6 py-8">
      <Text className="text-sm text-tertiary">
        {recipientEmail ? (
          <>
            This email was sent to{" "}
            <EmailButton
              href={`mailto:${recipientEmail}`}
              className="text-brand-secondary"
            >
              <span className="underline">{recipientEmail}</span>
            </EmailButton>
            .{" "}
          </>
        ) : null}
        If you'd rather not receive this kind of email, you can{" "}
        <EmailButton
          href={legalLinks?.unsubscribe || "#"}
          className="text-brand-secondary"
        >
          <span className="underline">unsubscribe</span>
        </EmailButton>
        {legalLinks?.preferences ? (
          <>
            {" "}
            or{" "}
            <EmailButton
              href={legalLinks.preferences}
              className="text-brand-secondary"
            >
              <span className="underline">manage your email preferences</span>
            </EmailButton>
          </>
        ) : null}
        . <br />
        <br />
        &copy; {copyrightYear} {companyName}
        {address ? `, ${address}` : ""}
      </Text>

      <Row className="mt-12">
        <Column>
          <Logo logoUrl={logoUrl} logoAlt={logoAlt} companyName={companyName} />
        </Column>
        {socialLinks?.twitter && (
          <Column className="ml-auto w-9">
            <EmailButton
              aria-label="X (formerly Twitter)"
              href={socialLinks.twitter}
            >
              <Img
                aria-hidden
                className="size-5"
                src="https://www.untitledui.com/images/email/x.webp"
                alt="X logo"
              />
            </EmailButton>
          </Column>
        )}
        {socialLinks?.facebook && (
          <Column className="w-9">
            <EmailButton aria-label="Facebook" href={socialLinks.facebook}>
              <Img
                aria-hidden
                className="size-5"
                src="https://www.untitledui.com/images/email/facebook.webp"
                alt="Facebook logo"
              />
            </EmailButton>
          </Column>
        )}
        {socialLinks?.instagram && (
          <Column className="w-5">
            <EmailButton aria-label="Instagram" href={socialLinks.instagram}>
              <Img
                aria-hidden
                className="size-5"
                src="https://www.untitledui.com/images/email/instagram.webp"
                alt="Instagram logo"
              />
            </EmailButton>
          </Column>
        )}
      </Row>
    </Container>
  );
};

export const CenterAligned = ({
  companyName = defaultEmailConfig.companyName,
  copyrightYear = defaultEmailConfig.copyrightYear,
  address = defaultEmailConfig.address,
  socialLinks = defaultEmailConfig.socialLinks,
  legalLinks = defaultEmailConfig.legalLinks,
  customMessage,
}: FooterProps = {}) => {
  return (
    <Container className="max-w-full bg-primary px-6 py-8">
      <Row align="center" className="mb-8">
        <Column align="center">
          {socialLinks?.twitter && (
            <EmailButton
              aria-label="X (formerly Twitter)"
              href={socialLinks.twitter}
            >
              <Img
                aria-hidden
                src="https://www.untitledui.com/images/email/x.webp"
                alt="X logo"
                className="size-5"
              />
            </EmailButton>
          )}
          {socialLinks?.facebook && (
            <EmailButton
              aria-label="Facebook"
              href={socialLinks.facebook}
              className="mx-4"
            >
              <Img
                aria-hidden
                src="https://www.untitledui.com/images/email/facebook.webp"
                alt="Facebook logo"
                className="size-5"
              />
            </EmailButton>
          )}
          {socialLinks?.instagram && (
            <EmailButton aria-label="Instagram" href={socialLinks.instagram}>
              <Img
                aria-hidden
                src="https://www.untitledui.com/images/email/instagram.webp"
                alt="Instagram logo"
                className="size-5"
              />
            </EmailButton>
          )}
        </Column>
      </Row>
      <Row>
        <Text className="text-center text-sm text-tertiary">
          {customMessage || ""}
          {customMessage ? " " : ""}
          If you'd prefer to not receive these emails, please{" "}
          <EmailButton
            href={legalLinks?.unsubscribe || "#"}
            className="text-brand-secondary"
          >
            <span className="underline">unsubscribe</span>
          </EmailButton>
          .
          <br />
          <br />
          &copy; {copyrightYear} {companyName}
          {address && (
            <>
              <br />
              {address}
            </>
          )}
        </Text>
      </Row>
    </Container>
  );
};

export const CenterAlignedDivider = ({
  companyName = defaultEmailConfig.companyName,
  copyrightYear = defaultEmailConfig.copyrightYear,
  address = defaultEmailConfig.address,
  legalLinks = defaultEmailConfig.legalLinks,
}: FooterProps = {}) => {
  return (
    <Container className="max-w-full bg-primary px-6 py-8">
      <Row className="mb-8">
        <Column>
          <Hr className="border-t border-secondary" />
        </Column>
      </Row>
      <Row className="mb-8">
        <Text className="text-center text-sm text-tertiary">
          You're receiving this email because you subscribed to receive
          marketing emails. If you'd prefer to not receive these emails, please{" "}
          <EmailButton
            href={legalLinks?.unsubscribe || "#"}
            className="text-brand-secondary"
          >
            <span className="underline">unsubscribe</span>
          </EmailButton>
          .
        </Text>
      </Row>
      <Row className="mb-8">
        <Column align="center">
          <EmailButton
            href={legalLinks?.terms || "#"}
            className="mr-4 text-sm text-tertiary"
          >
            <Text className="underline">Terms</Text>
          </EmailButton>
          <EmailButton
            href={legalLinks?.privacy || "#"}
            className="mr-2 text-sm text-tertiary"
          >
            <Text className="underline">Privacy</Text>
          </EmailButton>
          <EmailButton
            href={legalLinks?.cookies || "#"}
            className="ml-2 text-sm text-tertiary"
          >
            <Text className="underline">Cookies</Text>
          </EmailButton>
          <EmailButton
            href={legalLinks?.contact || "#"}
            className="ml-4 text-sm text-tertiary"
          >
            <Text className="underline">Contact us</Text>
          </EmailButton>
        </Column>
      </Row>
      <Row>
        <Text className="text-center text-sm text-tertiary">
          &copy; {copyrightYear} {companyName}
          {address && (
            <>
              <br />
              {address}
            </>
          )}
        </Text>
      </Row>
    </Container>
  );
};

export const LeftAlignedActions = ({
  companyName = defaultEmailConfig.companyName,
  recipientEmail,
  logoUrl = defaultEmailConfig.logoUrl,
  logoAlt = defaultEmailConfig.logoAlt || "CrowCommerce",
  copyrightYear = defaultEmailConfig.copyrightYear,
  address = defaultEmailConfig.address,
  socialLinks = defaultEmailConfig.socialLinks,
  legalLinks = defaultEmailConfig.legalLinks,
  appLinks,
}: FooterProps = {}) => {
  return (
    <Container className="max-w-full bg-primary px-6 py-8">
      <Row className="mb-2">
        <Text className="text-md font-semibold text-primary">
          Download the app
        </Text>
      </Row>
      <Row className="mb-6">
        <Text className="text-sm text-tertiary">
          Get the most of {companyName} by installing our new mobile app.
        </Text>
      </Row>
      <Row align="left" className="mb-12">
        <Column align="left" className="w-[120px] pr-1.5">
          <EmailButton
            aria-label="Download in App Store"
            href={appLinks?.appStore || "#"}
          >
            <Img
              aria-hidden
              src="https://www.untitledui.com/images/email/app-store.webp"
              alt="App Store"
              className="h-10"
            />
          </EmailButton>
        </Column>
        <Column align="left" className="pl-1.5">
          <EmailButton
            aria-label="Download in Google Play"
            href={appLinks?.googlePlay || "#"}
          >
            <Img
              aria-hidden
              src="https://www.untitledui.com/images/email/google-play.webp"
              alt="Google play"
              className="h-10"
            />
          </EmailButton>
        </Column>
      </Row>
      <Row className="mb-12">
        <Text className="text-sm text-tertiary">
          {recipientEmail ? (
            <>
              This email was sent to{" "}
              <EmailButton
                href={`mailto:${recipientEmail}`}
                className="text-brand-secondary"
              >
                <span className="underline">{recipientEmail}</span>
              </EmailButton>
              .{" "}
            </>
          ) : null}
          If you'd rather not receive this kind of email, you can{" "}
          <EmailButton
            href={legalLinks?.unsubscribe || "#"}
            className="text-brand-secondary"
          >
            <span className="underline">unsubscribe</span>
          </EmailButton>
          {legalLinks?.preferences ? (
            <>
              {" "}
              or{" "}
              <EmailButton
                href={legalLinks.preferences}
                className="text-brand-secondary"
              >
                <span className="underline">manage your email preferences</span>
              </EmailButton>
            </>
          ) : null}
          . <br />
          <br />
          &copy; {copyrightYear} {companyName}
          {address ? `, ${address}` : ""}
        </Text>
      </Row>
      <Row>
        <Column>
          <Logo logoUrl={logoUrl} logoAlt={logoAlt} companyName={companyName} />
        </Column>
        {socialLinks?.twitter && (
          <Column className="ml-auto w-9">
            <EmailButton
              aria-label="X (formerly Twitter)"
              href={socialLinks.twitter}
            >
              <Img
                aria-hidden
                className="size-5"
                src="https://www.untitledui.com/images/email/x.webp"
                alt="X logo"
              />
            </EmailButton>
          </Column>
        )}
        {socialLinks?.facebook && (
          <Column className="w-9">
            <EmailButton aria-label="Facebook" href={socialLinks.facebook}>
              <Img
                aria-hidden
                className="size-5"
                src="https://www.untitledui.com/images/email/facebook.webp"
                alt="Facebook logo"
              />
            </EmailButton>
          </Column>
        )}
        {socialLinks?.instagram && (
          <Column className="w-5">
            <EmailButton aria-label="Instagram" href={socialLinks.instagram}>
              <Img
                aria-hidden
                className="size-5"
                src="https://www.untitledui.com/images/email/instagram.webp"
                alt="Instagram logo"
              />
            </EmailButton>
          </Column>
        )}
      </Row>
    </Container>
  );
};

export const CenterAlignedActions = ({
  companyName = defaultEmailConfig.companyName,
  copyrightYear = defaultEmailConfig.copyrightYear,
  address = defaultEmailConfig.address,
  socialLinks = defaultEmailConfig.socialLinks,
  legalLinks = defaultEmailConfig.legalLinks,
  appLinks,
  customMessage,
}: FooterProps = {}) => {
  return (
    <Container className="max-w-full bg-primary px-6 py-8">
      <Row align="center" className="mb-2">
        <Text className="text-center text-md font-semibold text-primary">
          Download the app
        </Text>
      </Row>
      <Row align="center" className="mb-6">
        <Text className="text-center text-sm text-tertiary">
          Get the most of {companyName} by installing our new mobile app.
        </Text>
      </Row>
      <Row align="center" className="mb-8">
        <Column align="right" className="pr-1.5">
          <EmailButton
            aria-label="Download in App Store"
            href={appLinks?.appStore || "#"}
          >
            <Img
              aria-hidden
              src="https://www.untitledui.com/images/email/app-store.webp"
              alt="App Store"
              className="h-10"
            />
          </EmailButton>
        </Column>
        <Column align="left" className="pl-1.5">
          <EmailButton
            aria-label="Download in Google Play"
            href={appLinks?.googlePlay || "#"}
          >
            <Img
              aria-hidden
              src="https://www.untitledui.com/images/email/google-play.webp"
              alt="Google play"
              className="h-10"
            />
          </EmailButton>
        </Column>
      </Row>
      <Row align="center" className="mb-8">
        <Column align="center">
          {socialLinks?.twitter && (
            <EmailButton
              aria-label="X (formerly Twitter)"
              href={socialLinks.twitter}
            >
              <Img
                aria-hidden
                src="https://www.untitledui.com/images/email/x.webp"
                alt="X logo"
                className="size-5"
              />
            </EmailButton>
          )}
          {socialLinks?.facebook && (
            <EmailButton
              aria-label="Facebook"
              href={socialLinks.facebook}
              className="mx-4"
            >
              <Img
                aria-hidden
                src="https://www.untitledui.com/images/email/facebook.webp"
                alt="Facebook logo"
                className="size-5"
              />
            </EmailButton>
          )}
          {socialLinks?.instagram && (
            <EmailButton aria-label="Instagram" href={socialLinks.instagram}>
              <Img
                aria-hidden
                src="https://www.untitledui.com/images/email/instagram.webp"
                alt="Instagram logo"
                className="size-5"
              />
            </EmailButton>
          )}
        </Column>
      </Row>
      <Row>
        <Text className="text-center text-sm text-tertiary">
          {customMessage || ""}
          {customMessage ? " " : ""}
          If you'd prefer to not receive these emails, please{" "}
          <EmailButton
            href={legalLinks?.unsubscribe || "#"}
            className="text-brand-secondary"
          >
            <span className="underline">unsubscribe</span>
          </EmailButton>
          .
          <br />
          <br />
          &copy; {copyrightYear} {companyName}
          {address && (
            <>
              <br />
              {address}
            </>
          )}
        </Text>
      </Row>
    </Container>
  );
};

export const CenterAlignedDividerActions = ({
  companyName = defaultEmailConfig.companyName,
  copyrightYear = defaultEmailConfig.copyrightYear,
  address = defaultEmailConfig.address,
  legalLinks = defaultEmailConfig.legalLinks,
  appLinks,
}: FooterProps = {}) => {
  return (
    <Container className="max-w-full bg-primary px-6 py-8">
      <Row className="mb-8">
        <Column>
          <Hr className="border-t border-secondary" />
        </Column>
      </Row>
      <Row align="center" className="mb-2">
        <Text className="text-center text-md font-semibold text-primary">
          Download the app
        </Text>
      </Row>
      <Row align="center" className="mb-6">
        <Text className="text-center text-sm text-tertiary">
          Get the most of {companyName} by installing our new mobile app.
        </Text>
      </Row>
      <Row align="center" className="mb-8">
        <Column align="right" className="pr-1.5">
          <EmailButton
            aria-label="Download in App Store"
            href={appLinks?.appStore || "#"}
          >
            <Img
              aria-hidden
              src="https://www.untitledui.com/images/email/app-store.webp"
              alt="App Store"
              className="h-10"
            />
          </EmailButton>
        </Column>
        <Column align="left" className="pl-1.5">
          <EmailButton
            aria-label="Download in Google Play"
            href={appLinks?.googlePlay || "#"}
          >
            <Img
              aria-hidden
              src="https://www.untitledui.com/images/email/google-play.webp"
              alt="Google play"
              className="h-10"
            />
          </EmailButton>
        </Column>
      </Row>
      <Row className="mb-8">
        <Column>
          <Hr className="border-t border-secondary" />
        </Column>
      </Row>
      <Row className="mb-8">
        <Text className="text-center text-sm text-tertiary">
          You're receiving this email because you subscribed to receive
          marketing emails. If you'd prefer to not receive these emails, please{" "}
          <EmailButton
            href={legalLinks?.unsubscribe || "#"}
            className="text-brand-secondary"
          >
            <span className="underline">unsubscribe</span>
          </EmailButton>
          .
        </Text>
      </Row>
      <Row className="mb-8">
        <Column align="center">
          <EmailButton
            href={legalLinks?.terms || "#"}
            className="mr-4 text-sm text-tertiary"
          >
            <Text className="underline">Terms</Text>
          </EmailButton>
          <EmailButton
            href={legalLinks?.privacy || "#"}
            className="mr-2 text-sm text-tertiary"
          >
            <Text className="underline">Privacy</Text>
          </EmailButton>
          <EmailButton
            href={legalLinks?.cookies || "#"}
            className="ml-2 text-sm text-tertiary"
          >
            <Text className="underline">Cookies</Text>
          </EmailButton>
          <EmailButton
            href={legalLinks?.contact || "#"}
            className="ml-4 text-sm text-tertiary"
          >
            <Text className="underline">Contact us</Text>
          </EmailButton>
        </Column>
      </Row>
      <Row>
        <Text className="text-center text-sm text-tertiary">
          &copy; {copyrightYear} {companyName}
          {address && (
            <>
              <br />
              {address}
            </>
          )}
        </Text>
      </Row>
    </Container>
  );
};
