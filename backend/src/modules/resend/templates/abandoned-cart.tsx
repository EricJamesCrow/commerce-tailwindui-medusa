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
import { ItemTable } from "./_commerce/item-table";
import { getEmailConfig } from "./_config/email-config";
import type { CommerceLineItem, BaseTemplateProps } from "./types";

export interface AbandonedCartProps extends BaseTemplateProps {
  customerName?: string;
  items: CommerceLineItem[];
  subtotal: string;
  recoveryUrl: string;
  currencyCode?: string;
}

export function isValidAbandonedCartData(
  data: unknown,
): data is AbandonedCartProps {
  const d = data as Record<string, any>;
  return (
    Array.isArray(d?.items) &&
    typeof d?.subtotal === "string" &&
    typeof d?.recoveryUrl === "string"
  );
}

export const AbandonedCart = ({
  theme,
  customerName,
  items,
  subtotal,
  recoveryUrl,
  brandConfig,
}: AbandonedCartProps) => {
  const config = getEmailConfig(brandConfig);
  const greeting = customerName ? `Hi ${customerName},` : "Hi there,";

  return (
    <Html>
      <Tailwind theme={theme}>
        <Head />
        <Preview>You left items in your cart - {subtotal}</Preview>
        <Body>
          <Container
            align="center"
            className="w-full max-w-160 bg-primary md:p-8"
          >
            <Header logoUrl={config.logoUrl} logoAlt={config.logoAlt} />
            <Section align="left" className="max-w-full px-6 py-8">
              <Row className="mb-6">
                <Text className="text-display-xs font-semibold text-primary">
                  You Left Something Behind
                </Text>
              </Row>
              <Row className="mb-6">
                <Text className="text-tertiary">
                  {greeting}
                  <br />
                  <br />
                  We noticed you left some items in your cart. They're still
                  waiting for you — come back and complete your purchase.
                </Text>
              </Row>

              <ItemTable items={items} />

              <Row className="mb-2 mt-4 border-t border-solid border-secondary pt-4">
                <Text className="m-0 text-sm font-semibold text-primary">
                  Subtotal: {subtotal}
                </Text>
              </Row>

              <Row className="mt-6 mb-6">
                <Button href={recoveryUrl}>
                  <Text className="text-md font-semibold">
                    Return to your cart
                  </Text>
                </Button>
              </Row>

              <Row>
                <Text className="text-md text-tertiary">
                  If you've already completed your purchase, please ignore this
                  email.
                  <br />
                  <br />
                  Questions? Contact us at{" "}
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

AbandonedCart.PreviewProps = {
  customerName: "Sarah",
  items: [
    {
      name: "Leather Crossbody Bag",
      variant: "Tan / One Size",
      quantity: 1,
      price: "$128.00",
      imageUrl: "https://placehold.co/128x128?text=Product",
    },
    {
      name: "Merino Wool Scarf",
      variant: "Charcoal",
      quantity: 2,
      price: "$98.00",
      imageUrl: "https://placehold.co/128x128?text=Product",
    },
  ],
  subtotal: "$226.00",
  recoveryUrl: "http://localhost:3000/cart/recover/cart_01ABC?token=abc123",
  currencyCode: "USD",
} satisfies AbandonedCartProps;

export default AbandonedCart;
