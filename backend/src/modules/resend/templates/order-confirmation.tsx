// backend/src/modules/resend/templates/order-confirmation.tsx
import { Container, Html, Preview, Row, Section, Column } from "@react-email/components";
import { Body } from "./_components/body";
import { Button } from "./_components/button";
import { LeftAligned as Footer } from "./_components/footer";
import { Head } from "./_components/head";
import { LeftAligned as Header } from "./_components/header";
import { Tailwind } from "./_components/tailwind";
import { Text } from "./_components/text";
import { OrderSummary } from "./_commerce/order-summary";
import { AddressBlock } from "./_commerce/address-block";
import { PaymentDetails } from "./_components/line-items";
import { getEmailConfig } from "./_config/email-config";
import type { CommerceLineItem, Address, BaseTemplateProps } from "./types";

export interface OrderConfirmationProps extends BaseTemplateProps {
  customerName?: string;
  orderNumber: string;
  orderDate: string;
  items: CommerceLineItem[];
  subtotal: string;
  shipping: string;
  tax?: string;
  discount?: string;
  total: string;
  paymentMethod: string;
  cardLast4?: string;
  shippingAddress: Address;
  billingAddress?: Address;
  orderStatusUrl?: string;
}

export const OrderConfirmation = ({
  theme,
  customerName,
  orderNumber,
  orderDate,
  items,
  subtotal,
  shipping,
  tax,
  total,
  paymentMethod,
  cardLast4,
  shippingAddress,
  billingAddress,
  orderStatusUrl,
  discount,
  brandConfig,
}: OrderConfirmationProps) => {
  const config = getEmailConfig(brandConfig);
  const greeting = customerName ? `Hi ${customerName},` : "Hi there,";

  return (
    <Html>
      <Tailwind theme={theme}>
        <Head />
        <Preview>
          Order #{orderNumber} confirmed - {total}
        </Preview>
        <Body>
          <Container align="center" className="w-full max-w-160 bg-primary md:p-8">
            <Header logoUrl={config.logoUrl} logoAlt={config.logoAlt} />
            <Section align="left" className="max-w-full px-6 py-8">
              <Row className="mb-6">
                <Text className="text-display-xs font-semibold text-primary">
                  Order Confirmed
                </Text>
              </Row>
              <Row className="mb-6">
                <Text className="text-tertiary">
                  {greeting}
                  <br />
                  <br />
                  Thank you for your order! We've received your order and
                  will begin processing it shortly.
                </Text>
              </Row>

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

              {/* Item list */}
              <Section className="my-6 rounded-lg border border-solid border-secondary">
                <Row className="border-b border-solid border-secondary bg-secondary px-4 py-3">
                  <Column className="w-[50%]">
                    <Text className="m-0 text-xs font-medium uppercase text-tertiary">
                      Item
                    </Text>
                  </Column>
                  <Column className="w-[15%]" align="center">
                    <Text className="m-0 text-xs font-medium uppercase text-tertiary">
                      Qty
                    </Text>
                  </Column>
                  <Column className="w-[20%]" align="right">
                    <Text className="m-0 text-xs font-medium uppercase text-tertiary">
                      Price
                    </Text>
                  </Column>
                </Row>
                {items.map((item, index) => (
                  <Row
                    key={index}
                    className={`px-4 py-3 ${
                      index < items.length - 1
                        ? "border-b border-solid border-secondary"
                        : ""
                    }`}
                  >
                    <Column className="w-[50%]">
                      <Text className="m-0 text-sm text-primary">
                        {item.name}
                      </Text>
                      {item.variant && (
                        <Text className="m-0 text-xs text-tertiary">
                          {item.variant}
                        </Text>
                      )}
                    </Column>
                    <Column className="w-[15%]" align="center">
                      <Text className="m-0 text-sm text-tertiary">
                        {item.quantity || 1}
                      </Text>
                    </Column>
                    <Column className="w-[20%]" align="right">
                      <Text className="m-0 text-sm text-primary">
                        {item.price}
                      </Text>
                    </Column>
                  </Row>
                ))}
              </Section>

              <OrderSummary
                subtotal={subtotal}
                shipping={shipping}
                discount={discount}
                tax={tax}
                total={total}
              />

              <PaymentDetails
                method={paymentMethod}
                cardLast4={cardLast4}
              />

              <Row>
                <Column className="w-1/2">
                  <AddressBlock label="Shipping Address" address={shippingAddress} />
                </Column>
                {billingAddress && (
                  <Column className="w-1/2">
                    <AddressBlock label="Billing Address" address={billingAddress} />
                  </Column>
                )}
              </Row>

              {orderStatusUrl && (
                <Row className="mt-6 mb-6">
                  <Button href={orderStatusUrl}>
                    <Text className="text-md font-semibold">View your order</Text>
                  </Button>
                </Row>
              )}

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

OrderConfirmation.PreviewProps = {
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
  paymentMethod: "Card",
  cardLast4: "4242",
  shippingAddress: {
    name: "Sarah Chen",
    line1: "123 Market Street",
    line2: "Apt 4B",
    city: "San Francisco",
    state: "CA",
    postalCode: "94105",
    country: "US",
  },
  orderStatusUrl: "http://localhost:3000/account/orders/order_01ABC",
} satisfies OrderConfirmationProps;

export default OrderConfirmation;
