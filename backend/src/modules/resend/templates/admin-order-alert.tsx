// backend/src/modules/resend/templates/admin-order-alert.tsx
import { Container, Html, Preview, Row, Section, Column } from "@react-email/components";
import { Body } from "./_components/body";
import { Button } from "./_components/button";
import { Head } from "./_components/head";
import { LeftAligned as Header } from "./_components/header";
import { Tailwind } from "./_components/tailwind";
import { Text } from "./_components/text";
import { AddressBlock } from "./_commerce/address-block";
import { ItemTable } from "./_commerce/item-table";
import { OrderSummary } from "./_commerce/order-summary";
import { getEmailConfig } from "./_config/email-config";
import type { CommerceLineItem, Address, BaseTemplateProps } from "./types";

export interface AdminOrderAlertProps extends BaseTemplateProps {
  orderNumber: string;
  orderDate: string;
  customerEmail: string;
  customerName?: string;
  items: CommerceLineItem[];
  subtotal: string;
  shipping: string;
  tax?: string;
  discount?: string;
  total: string;
  shippingAddress: Address;
  billingAddress?: Address;
  adminOrderUrl?: string;
}

export const AdminOrderAlert = ({
  theme,
  orderNumber,
  orderDate,
  customerEmail,
  customerName,
  items,
  subtotal,
  shipping,
  tax,
  discount,
  total,
  shippingAddress,
  billingAddress,
  adminOrderUrl,
  brandConfig,
}: AdminOrderAlertProps) => {
  const config = getEmailConfig(brandConfig);

  return (
    <Html>
      <Tailwind theme={theme}>
        <Head />
        <Preview>New order #{orderNumber} — {total}</Preview>
        <Body>
          <Container align="center" className="w-full max-w-160 bg-primary md:p-8">
            <Header logoUrl={config.logoUrl} logoAlt={config.logoAlt} />
            <Section align="left" className="max-w-full px-6 py-8">
              <Row className="mb-6">
                <Text className="text-display-xs font-semibold text-primary">
                  New order received
                </Text>
              </Row>

              {/* Customer + order info box */}
              <Section className="mb-6 rounded-lg border border-solid border-secondary bg-secondary p-4">
                <Row className="py-1">
                  <Column className="w-[40%]">
                    <Text className="m-0 text-xs font-medium uppercase text-tertiary">
                      Order Number
                    </Text>
                  </Column>
                  <Column className="w-[60%]" align="right">
                    <Text className="m-0 text-sm font-semibold text-primary">
                      #{orderNumber}
                    </Text>
                  </Column>
                </Row>
                <Row className="py-1">
                  <Column className="w-[40%]">
                    <Text className="m-0 text-xs font-medium uppercase text-tertiary">
                      Order Date
                    </Text>
                  </Column>
                  <Column className="w-[60%]" align="right">
                    <Text className="m-0 text-sm text-primary">
                      {orderDate}
                    </Text>
                  </Column>
                </Row>
                <Row className="py-1">
                  <Column className="w-[40%]">
                    <Text className="m-0 text-xs font-medium uppercase text-tertiary">
                      Customer
                    </Text>
                  </Column>
                  <Column className="w-[60%]" align="right">
                    <Text className="m-0 text-sm text-primary">
                      {customerName || customerEmail}
                    </Text>
                  </Column>
                </Row>
                {customerName && (
                  <Row className="py-1">
                    <Column className="w-[40%]">
                      <Text className="m-0 text-xs font-medium uppercase text-tertiary">
                        Email
                      </Text>
                    </Column>
                    <Column className="w-[60%]" align="right">
                      <Text className="m-0 text-sm text-primary">
                        {customerEmail}
                      </Text>
                    </Column>
                  </Row>
                )}
                <Row className="border-t border-solid border-secondary pt-2 mt-1 py-1">
                  <Column className="w-[40%]">
                    <Text className="m-0 text-xs font-medium uppercase text-tertiary">
                      Order Total
                    </Text>
                  </Column>
                  <Column className="w-[60%]" align="right">
                    <Text className="m-0 text-sm font-semibold text-primary">
                      {total}
                    </Text>
                  </Column>
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

              {(adminOrderUrl || config.appUrl) && (
                <Row className="mt-6 mb-6">
                  <Button href={adminOrderUrl || config.appUrl || config.websiteUrl}>
                    <Text className="text-md font-semibold">View in admin</Text>
                  </Button>
                </Row>
              )}
            </Section>

            {/* Minimal admin footer — no social/legal */}
            <Section className="px-6 pb-6">
              <Row>
                <Text className="m-0 text-xs text-tertiary">
                  This is an automated notification from {config.companyName}.
                </Text>
              </Row>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

AdminOrderAlert.PreviewProps = {
  orderNumber: "1042",
  orderDate: "March 14, 2026",
  customerName: "Sarah Chen",
  customerEmail: "sarah.chen@example.com",
  items: [
    { name: "Leather Crossbody Bag", variant: "Tan / One Size", quantity: 1, price: "$128.00" },
    { name: "Merino Wool Scarf", variant: "Charcoal", quantity: 2, price: "$98.00" },
  ],
  subtotal: "$226.00",
  shipping: "$8.00",
  tax: "$18.72",
  discount: "$10.00",
  total: "$242.72",
  shippingAddress: {
    name: "Sarah Chen",
    line1: "123 Market Street",
    line2: "Apt 4B",
    city: "San Francisco",
    state: "CA",
    postalCode: "94105",
    country: "US",
  },
  billingAddress: {
    name: "Sarah Chen",
    line1: "456 Financial District Blvd",
    city: "San Francisco",
    state: "CA",
    postalCode: "94111",
    country: "US",
  },
  adminOrderUrl: "http://localhost:9000/app/orders/order_01ABC",
} satisfies AdminOrderAlertProps;

export default AdminOrderAlert;
