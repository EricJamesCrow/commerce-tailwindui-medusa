// backend/src/modules/resend/templates/order-confirmation.tsx
import {
  Container,
  Html,
  Preview,
  Row,
  Section,
  Column,
} from "@react-email/components";
import { Body } from "./_components/body";
import { Button } from "./_components/button";
import { LeftAligned as Footer } from "./_components/footer";
import { Head } from "./_components/head";
import { LeftAligned as Header } from "./_components/header";
import { Tailwind } from "./_components/tailwind";
import { Text } from "./_components/text";
import { PaymentDetails } from "./_components/line-items";
import { AddressBlock } from "./_commerce/address-block";
import { ItemTable } from "./_commerce/item-table";
import { OrderSummary } from "./_commerce/order-summary";
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
  invoiceMode?: "link" | "attachment";
  invoiceDownloadUrl?: string;
}

export function isValidOrderConfirmationData(
  data: unknown,
): data is OrderConfirmationProps {
  const d = data as Record<string, any>;
  return (
    typeof d?.orderNumber === "string" &&
    typeof d?.orderDate === "string" &&
    Array.isArray(d?.items) &&
    typeof d?.subtotal === "string" &&
    typeof d?.shipping === "string" &&
    typeof d?.total === "string" &&
    typeof d?.paymentMethod === "string" &&
    typeof d?.shippingAddress === "object" &&
    d?.shippingAddress !== null
  );
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
  invoiceMode,
  invoiceDownloadUrl,
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
          <Container
            align="center"
            className="w-full max-w-160 bg-primary md:p-8"
          >
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
                  Thank you for your order! We've received your order and will
                  begin processing it shortly.
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

              <ItemTable items={items} />

              <OrderSummary
                subtotal={subtotal}
                shipping={shipping}
                discount={discount}
                tax={tax}
                total={total}
              />

              <PaymentDetails method={paymentMethod} cardLast4={cardLast4} />

              <Row>
                <Column className="w-1/2">
                  <AddressBlock
                    label="Shipping Address"
                    address={shippingAddress}
                  />
                </Column>
                {billingAddress && (
                  <Column className="w-1/2">
                    <AddressBlock
                      label="Billing Address"
                      address={billingAddress}
                    />
                  </Column>
                )}
              </Row>

              {orderStatusUrl && (
                <Row className="mt-6 mb-6">
                  <Button href={orderStatusUrl}>
                    <Text className="text-md font-semibold">
                      View your order
                    </Text>
                  </Button>
                </Row>
              )}

              {invoiceMode === "link" && invoiceDownloadUrl && (
                <Row className="mb-6">
                  <Button color="secondary" href={invoiceDownloadUrl}>
                    <Text className="text-md font-semibold">
                      Download Invoice
                    </Text>
                  </Button>
                </Row>
              )}

              {invoiceMode === "attachment" && (
                <Row className="mb-6">
                  <Text className="text-tertiary">
                    Your invoice is attached to this email.
                  </Text>
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
    { name: "Gift Wrapping", quantity: 1, price: "$5.00" },
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
  invoiceMode: "link",
  invoiceDownloadUrl: "http://localhost:3000/api/orders/order_01ABC/invoice",
} satisfies OrderConfirmationProps;

export default OrderConfirmation;
