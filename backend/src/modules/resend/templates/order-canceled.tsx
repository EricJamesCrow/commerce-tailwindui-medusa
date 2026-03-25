// backend/src/modules/resend/templates/order-canceled.tsx
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

export function isValidOrderCanceledData(
  data: unknown,
): data is OrderCanceledProps {
  const d = data as Record<string, any>;
  return (
    typeof d?.orderNumber === "string" &&
    typeof d?.orderDate === "string" &&
    Array.isArray(d?.items) &&
    typeof d?.subtotal === "string" &&
    typeof d?.shipping === "string" &&
    typeof d?.total === "string" &&
    typeof d?.refundMessage === "string"
  );
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

  return (
    <Html>
      <Tailwind theme={theme}>
        <Head />
        <Preview>Your order #{orderNumber} has been canceled</Preview>
        <Body>
          <Container
            align="center"
            className="w-full max-w-160 bg-primary md:p-8"
          >
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
                  We're sorry to let you know that your order #{
                    orderNumber
                  }{" "}
                  placed on {orderDate} has been canceled.
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

              <ItemTable items={items} />

              <OrderSummary
                subtotal={subtotal}
                shipping={shipping}
                discount={discount}
                tax={tax}
                total={total}
              />

              <Row className="mb-6">
                <Text className="text-md text-tertiary">
                  If you have any questions about your cancellation or refund,
                  contact us at{" "}
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
                  <Text className="text-md font-semibold">
                    Continue shopping
                  </Text>
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
  shipping: "$8.00",
  tax: "$18.72",
  discount: "$10.00",
  total: "$242.72",
  refundMessage:
    "A refund of $242.72 has been issued to your original payment method and should appear within 5-10 business days.",
  shopUrl: "http://localhost:3000",
} satisfies OrderCanceledProps;

export default OrderCanceled;
