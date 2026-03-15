import { Column, Container, Button as EmailButton, Img, Row, Text as EmailText } from "@react-email/components";
import { Text } from "./text";
import { defaultEmailConfig, type EmailBrandConfig } from "../_config/email-config";

// TODO: self-host social icons — currently using UntitledUI CDN URLs

/**
 * Renders the logo as an image if a URL is provided, otherwise falls back to
 * a styled text wordmark using the companyName.
 */
const Logo = ({ logoUrl, logoAlt, companyName, className }: { logoUrl: string; logoAlt: string; companyName?: string; className?: string }) => {
    if (logoUrl) {
        return <Img src={logoUrl} alt={logoAlt} className={className || "h-7 md:h-8"} />;
    }
    return (
        <EmailText style={{ fontSize: "20px", fontWeight: 700, lineHeight: "28px", margin: 0, color: "#111827" }}>
            {companyName || "CrowCommerce"}
        </EmailText>
    );
};

/**
 * Props interface for configurable header components
 */
export interface HeaderProps {
    /** Company name for text fallback logo */
    companyName?: string;
    /** URL to the logo image */
    logoUrl?: string;
    /** Alt text for the logo */
    logoAlt?: string;
    /** URL when clicking the logo */
    homeUrl?: string;
    /** Navigation links to display */
    navLinks?: Array<{ label: string; href: string }>;
    /** Social media links */
    socialLinks?: {
        twitter?: string;
        facebook?: string;
        instagram?: string;
    };
    /** Login button URL */
    loginUrl?: string;
    /** Login button text */
    loginText?: string;
}

const defaultNavLinks = [
    { label: "Home", href: "#" },
    { label: "Blog", href: "#blog" },
    { label: "Tutorial", href: "#tutorial" },
    { label: "Support", href: "#support" },
];

export const LeftAligned = ({
    companyName = defaultEmailConfig.companyName,
    logoUrl = defaultEmailConfig.logoUrl,
    logoAlt = defaultEmailConfig.logoAlt || "CrowCommerce",
}: HeaderProps = {}) => {
    return (
        <Container align="left" className="max-w-full bg-primary p-6">
            <Row>
                <Logo logoUrl={logoUrl} logoAlt={logoAlt} companyName={companyName} />
            </Row>
        </Container>
    );
};

export const LeftAlignedLinks = ({
    companyName = defaultEmailConfig.companyName,
    logoUrl = defaultEmailConfig.logoUrl,
    logoAlt = defaultEmailConfig.logoAlt || "CrowCommerce",
    homeUrl = defaultEmailConfig.websiteUrl,
    navLinks = defaultNavLinks,
}: HeaderProps = {}) => {
    return (
        <Container align="left" className="max-w-full bg-primary p-6">
            <Row className="mb-8">
                <Logo logoUrl={logoUrl} logoAlt={logoAlt} companyName={companyName} />
            </Row>
            <Row>
                {navLinks.map((link, index) => (
                    <EmailButton
                        key={link.label}
                        href={index === 0 ? homeUrl : link.href}
                        className={`text-sm font-semibold text-primary md:text-md ${index > 0 ? "ml-4" : ""}`}
                    >
                        {link.label}
                    </EmailButton>
                ))}
            </Row>
        </Container>
    );
};

export const LeftAlignedSocials = ({
    companyName = defaultEmailConfig.companyName,
    logoUrl = defaultEmailConfig.logoUrl,
    logoAlt = defaultEmailConfig.logoAlt || "CrowCommerce",
    loginUrl = defaultEmailConfig.appUrl || defaultEmailConfig.websiteUrl,
    loginText = "Log in",
    socialLinks = defaultEmailConfig.socialLinks,
}: HeaderProps = {}) => {
    return (
        <Container align="center" className="max-w-full min-w-[354px] bg-primary p-6">
            <Row align="left" className="align-middle">
                <div className="flex w-full flex-1 items-center">
                    <Logo logoUrl={logoUrl} logoAlt={logoAlt} companyName={companyName} className="inline h-7 align-middle md:h-8" />

                    <EmailButton href={loginUrl} className="ml-auto align-middle">
                        <Text className="text-sm font-semibold text-primary md:text-md">{loginText}</Text>
                    </EmailButton>
                    {socialLinks?.twitter && (
                        <EmailButton aria-label="X (formerly Twitter)" href={socialLinks.twitter} className="ml-6 align-middle">
                            <Img src="https://www.untitledui.com/images/email/x-black.webp" alt="" className="size-5" />
                        </EmailButton>
                    )}
                    {socialLinks?.facebook && (
                        <EmailButton aria-label="Facebook" href={socialLinks.facebook} className="mx-4 align-middle">
                            <Img src="https://www.untitledui.com/images/email/facebook-black.webp" alt="" className="size-5" />
                        </EmailButton>
                    )}
                    {socialLinks?.instagram && (
                        <EmailButton aria-label="Instagram" href={socialLinks.instagram} className="align-middle">
                            <Img src="https://www.untitledui.com/images/email/instagram-black.webp" alt="" className="size-5" />
                        </EmailButton>
                    )}
                </div>
            </Row>
        </Container>
    );
};

export const CenterAligned = ({
    companyName = defaultEmailConfig.companyName,
    logoUrl = defaultEmailConfig.logoUrl,
    logoAlt = defaultEmailConfig.logoAlt || "CrowCommerce",
}: HeaderProps = {}) => {
    return (
        <Container align="center" className="max-w-full bg-primary p-6">
            <Row>
                <Column align="center">
                    <Logo logoUrl={logoUrl} logoAlt={logoAlt} companyName={companyName} />
                </Column>
            </Row>
        </Container>
    );
};

export const CenterAlignedLinks = ({
    companyName = defaultEmailConfig.companyName,
    logoUrl = defaultEmailConfig.logoUrl,
    logoAlt = defaultEmailConfig.logoAlt || "CrowCommerce",
    homeUrl = defaultEmailConfig.websiteUrl,
    navLinks = defaultNavLinks,
}: HeaderProps = {}) => {
    return (
        <Container align="center" className="max-w-full bg-primary p-6">
            <Row>
                <Column align="center">
                    <Logo logoUrl={logoUrl} logoAlt={logoAlt} companyName={companyName} />
                </Column>
            </Row>
            <Row align="center">
                <Column align="center">
                    {navLinks.map((link, index) => (
                        <EmailButton
                            key={link.label}
                            href={index === 0 ? homeUrl : link.href}
                            className={`text-sm font-semibold text-primary md:text-md ${index < navLinks.length - 1 ? (index < 2 ? "mr-4" : "ml-2") : "ml-4"}`}
                        >
                            {link.label}
                        </EmailButton>
                    ))}
                </Column>
            </Row>
        </Container>
    );
};

export const CenterAlignedSocials = ({
    companyName = defaultEmailConfig.companyName,
    logoUrl = defaultEmailConfig.logoUrl,
    logoAlt = defaultEmailConfig.logoAlt || "CrowCommerce",
    socialLinks = defaultEmailConfig.socialLinks,
}: HeaderProps = {}) => {
    return (
        <Container align="center" className="max-w-full min-w-[354px] bg-primary p-6">
            <Row>
                <Column align="center">
                    <Logo logoUrl={logoUrl} logoAlt={logoAlt} companyName={companyName} />
                </Column>
            </Row>
            <Row align="center">
                <Column align="center">
                    {socialLinks?.twitter && (
                        <EmailButton aria-label="X (formerly Twitter)" href={socialLinks.twitter}>
                            <Img src="https://www.untitledui.com/images/email/x-black.webp" alt="" className="size-5" />
                        </EmailButton>
                    )}
                    {socialLinks?.facebook && (
                        <EmailButton aria-label="Facebook" href={socialLinks.facebook} className="mx-4">
                            <Img src="https://www.untitledui.com/images/email/facebook-black.webp" alt="" className="size-5" />
                        </EmailButton>
                    )}
                    {socialLinks?.instagram && (
                        <EmailButton aria-label="Instagram" href={socialLinks.instagram}>
                            <Img src="https://www.untitledui.com/images/email/instagram-black.webp" alt="" className="size-5" />
                        </EmailButton>
                    )}
                </Column>
            </Row>
        </Container>
    );
};
