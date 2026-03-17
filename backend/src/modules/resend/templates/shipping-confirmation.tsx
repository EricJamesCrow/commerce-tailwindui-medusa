// backend/src/modules/resend/templates/shipping-confirmation.tsx
import { Container, Html, Preview, Row, Section, Column } from "@react-email/components";
import { Body } from "./_components/body";
import { Button } from "./_components/button";
import { LeftAligned as Footer } from "./_components/footer";
import { Head } from "./_components/head";
import { LeftAligned as Header } from "./_components/header";
import { Tailwind } from "./_components/tailwind";
import { Text } from "./_components/text";
import { AddressBlock } from "./_commerce/address-block";
import { ItemTable } from "./_commerce/item-table";
import { OrderSummary } from "./_commerce/order-summary";
import { getEmailConfig } from "./_config/email-config";
import type { CommerceLineItem, Address, BaseTemplateProps } from "./types";

export interface ShippingConfirmationProps extends BaseTemplateProps {
  customerName?: string;
  orderNumber: string;
  orderDate: string;
  items: CommerceLineItem[];
  subtotal: string;
  shipping: string;
  tax?: string;
  discount?: string;
  total: string;
  shippingAddress: Address;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  orderStatusUrl?: string;
}

export const ShippingConfirmation = ({
  theme,
  customerName,
  orderNumber,
  orderDate,
  items,
  subtotal,
  shipping,
  tax,
  discount,
  total,
  shippingAddress,
  trackingNumber,
  trackingUrl,
  orderStatusUrl,
  brandConfig,
}: ShippingConfirmationProps) => {
  const config = getEmailConfig(brandConfig);
  const greeting = customerName ? `Hi ${customerName},` : "Hi there,";

  return (
    <Html>
      <Tailwind theme={theme}>
        <Head />
        <Preview>Your order #{orderNumber} has shipped</Preview>
        <Body>
          <Container align="center" className="w-full max-w-160 bg-primary md:p-8">
            <Header logoUrl={config.logoUrl} logoAlt={config.logoAlt} />
            <Section align="left" className="max-w-full px-6 py-8">
              <Row className="mb-6">
                <Text className="text-display-xs font-semibold text-primary">
                  Your order is on its way!
                </Text>
              </Row>
              <Row className="mb-6">
                <Text className="text-tertiary">
                  {greeting}
                  <br />
                  <br />
                  Great news — your order has shipped and is headed your way.
                </Text>
              </Row>

              {trackingNumber && (
                <Section className="mb-6 rounded-lg border border-solid border-secondary bg-secondary p-4">
                  <Row>
                    <Text className="m-0 text-xs font-medium uppercase text-tertiary">
                      Tracking Number
                    </Text>
                    <Text className="m-0 mt-1 text-sm font-semibold text-primary">
                      {trackingUrl ? (
                        <a href={trackingUrl} className="text-brand-secondary">
                          {trackingNumber}
                        </a>
                      ) : (
                        trackingNumber
                      )}
                    </Text>
                  </Row>
                </Section>
              )}

              <Row className="mb-2">
                <Column>
                  <Text className="m-0 text-xs font-medium uppercase text-tertiary">
                    Order Number
                  </Text>
                  <Text className="m-0 mt-1 text-sm font-semibold text-primary">
                    #{orderNumber}
                  </Text>
                </Column>
                <Column align="right">
                  <Text className="m-0 text-xs font-medium uppercase text-tertiary">
                    Order Date
                  </Text>
                  <Text className="m-0 mt-1 text-sm text-primary">
                    {orderDate}
                  </Text>
                </Column>
              </Row>

              <ItemTable items={items} />

              <OrderSummary
                subtotal={subtotal}
                shipping={shipping}
                discount={discount}
                tax={tax}
                total={total}
              />

              <AddressBlock label="Shipping Address" address={shippingAddress} />

              <Row className="mt-6 mb-6">
                <Button href={trackingUrl || orderStatusUrl || config.appUrl || config.websiteUrl}>
                  <Text className="text-md font-semibold">
                    {trackingUrl ? "Track your order" : "View your order"}
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

ShippingConfirmation.PreviewProps = {
  customerName: "Sarah",
  orderNumber: "1042",
  orderDate: "March 14, 2026",
  items: [
    { name: "Leather Crossbody Bag", variant: "Tan / One Size", quantity: 1, price: "$128.00" },
    { name: "Merino Wool Scarf", variant: "Charcoal", quantity: 2, price: "$98.00" },
  ],
  subtotal: "$226.00",
  shipping: "$8.00",
  tax: "$18.72",
  total: "$252.72",
  shippingAddress: {
    name: "Sarah Chen",
    line1: "123 Market Street",
    line2: "Apt 4B",
    city: "San Francisco",
    state: "CA",
    postalCode: "94105",
    country: "US",
  },
  trackingNumber: "1Z999AA10123456784",
  trackingUrl: "https://www.ups.com/track?tracknum=1Z999AA10123456784",
  orderStatusUrl: "http://localhost:3000/account/orders/order_01ABC",
} satisfies ShippingConfirmationProps;

export default ShippingConfirmation;
