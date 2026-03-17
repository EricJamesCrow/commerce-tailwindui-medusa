// backend/src/modules/resend/templates/order-canceled.tsx
import { Container, Html, Preview, Row, Section, Column } from "@react-email/components";
import { Body } from "./_components/body";
import { Button } from "./_components/button";
import { LeftAligned as Footer } from "./_components/footer";
import { Head } from "./_components/head";
import { LeftAligned as Header } from "./_components/header";
import { Tailwind } from "./_components/tailwind";
import { Text } from "./_components/text";
import { OrderSummary } from "./_commerce/order-summary";
import { getEmailConfig } from "./_config/email-config";
import type { CommerceLineItem, BaseTemplateProps } from "./types";

export interface OrderCanceledProps extends BaseTemplateProps {
  customerName?: string;
  orderNumber: string;
  orderDate: string;
  items: CommerceLineItem[];
  subtotal: string;
  shipping: string;
  tax?: string;
  discount?: string;
  total: string;
  refundMessage: string;
  shopUrl?: string;
}

export const OrderCanceled = ({
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
  refundMessage,
  shopUrl,
  brandConfig,
}: OrderCanceledProps) => {
  const config = getEmailConfig(brandConfig);
  const greeting = customerName ? `Hi ${customerName},` : "Hi there,";
  const displayId = orderNumber;

  return (
    <Html>
      <Tailwind theme={theme}>
        <Head />
        <Preview>Your order #{displayId} has been canceled</Preview>
        <Body>
          <Container align="center" className="w-full max-w-160 bg-primary md:p-8">
            <Header logoUrl={config.logoUrl} logoAlt={config.logoAlt} />
            <Section align="left" className="max-w-full px-6 py-8">
              <Row className="mb-6">
                <Text className="text-display-xs font-semibold text-primary">
                  Your order has been canceled
                </Text>
              </Row>
              <Row className="mb-6">
                <Text className="text-tertiary">
                  {greeting}
                  <br />
                  <br />
                  We're sorry to let you know that your order #{orderNumber} placed on {orderDate} has been canceled.
                </Text>
              </Row>

              {/* Refund status box */}
              <Section className="mb-6 rounded-lg border border-solid border-secondary bg-secondary p-4">
                <Row>
                  <Text className="m-0 text-xs font-medium uppercase text-tertiary">
                    Refund Status
                  </Text>
                  <Text className="m-0 mt-2 text-sm text-primary">
                    {refundMessage}
                  </Text>
                </Row>
              </Section>

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

              <Row className="mb-6">
                <Text className="text-md text-tertiary">
                  If you have any questions about your cancellation or refund, contact us at{" "}
                  <a
                    href={`mailto:${config.supportEmail}`}
                    className="text-brand-secondary"
                  >
                    {config.supportEmail}
                  </a>
                  .
                </Text>
              </Row>

              <Row className="mt-2 mb-6">
                <Button href={shopUrl || config.websiteUrl}>
                  <Text className="text-md font-semibold">Continue shopping</Text>
                </Button>
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

OrderCanceled.PreviewProps = {
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
  discount: "$10.00",
  total: "$242.72",
  refundMessage: "A refund of $242.72 has been issued to your original payment method and should appear within 5-10 business days.",
  shopUrl: "http://localhost:3000",
} satisfies OrderCanceledProps;

export default OrderCanceled;
