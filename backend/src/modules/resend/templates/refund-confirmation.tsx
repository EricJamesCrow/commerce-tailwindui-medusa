// backend/src/modules/resend/templates/refund-confirmation.tsx
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
import { getEmailConfig } from "./_config/email-config";
import type { BaseTemplateProps } from "./types";

export interface RefundConfirmationProps extends BaseTemplateProps {
  orderNumber: string;
  refundAmount: string;
  refundDate: string;
  refundReason?: string;
  orderUrl?: string;
}

export function isValidRefundConfirmationData(
  data: unknown,
): data is RefundConfirmationProps {
  const d = data as Record<string, any>;
  return (
    typeof d?.orderNumber === "string" &&
    typeof d?.refundAmount === "string" &&
    typeof d?.refundDate === "string"
  );
}

export const RefundConfirmation = ({
  theme,
  orderNumber,
  refundAmount,
  refundDate,
  refundReason,
  orderUrl,
  brandConfig,
}: RefundConfirmationProps) => {
  const config = getEmailConfig(brandConfig);

  return (
    <Html>
      <Tailwind theme={theme}>
        <Head />
        <Preview>Refund issued for order #{orderNumber}</Preview>
        <Body>
          <Container
            align="center"
            className="w-full max-w-160 bg-primary md:p-8"
          >
            <Header logoUrl={config.logoUrl} logoAlt={config.logoAlt} />
            <Section align="left" className="max-w-full px-6 py-8">
              <Row className="mb-6">
                <Text className="text-display-xs font-semibold text-primary">
                  Your refund has been processed
                </Text>
              </Row>
              <Row className="mb-6">
                <Text className="text-tertiary">
                  We've issued a refund to your original payment method for
                  order #{orderNumber}.
                </Text>
              </Row>

              {/* Refund details box */}
              <Section className="mb-6 rounded-lg border border-solid border-secondary bg-secondary p-4">
                <Row className="py-1">
                  <Column className="w-[50%]">
                    <Text className="m-0 text-xs font-medium uppercase text-tertiary">
                      Refund Amount
                    </Text>
                  </Column>
                  <Column className="w-[50%]" align="right">
                    <Text className="m-0 text-sm font-semibold text-primary">
                      {refundAmount}
                    </Text>
                  </Column>
                </Row>
                <Row className="py-1">
                  <Column className="w-[50%]">
                    <Text className="m-0 text-xs font-medium uppercase text-tertiary">
                      Refund Date
                    </Text>
                  </Column>
                  <Column className="w-[50%]" align="right">
                    <Text className="m-0 text-sm text-primary">
                      {refundDate}
                    </Text>
                  </Column>
                </Row>
                {refundReason && (
                  <Row className="py-1">
                    <Column className="w-[50%]">
                      <Text className="m-0 text-xs font-medium uppercase text-tertiary">
                        Reason
                      </Text>
                    </Column>
                    <Column className="w-[50%]" align="right">
                      <Text className="m-0 text-sm text-primary">
                        {refundReason}
                      </Text>
                    </Column>
                  </Row>
                )}
                <Row className="border-t border-solid border-secondary pt-2 mt-1 py-1">
                  <Column className="w-[50%]">
                    <Text className="m-0 text-xs font-medium uppercase text-tertiary">
                      Order Number
                    </Text>
                  </Column>
                  <Column className="w-[50%]" align="right">
                    <Text className="m-0 text-sm text-primary">
                      #{orderNumber}
                    </Text>
                  </Column>
                </Row>
              </Section>

              <Row className="mb-6">
                <Text className="text-md text-tertiary">
                  Refunds typically appear on your statement within 5–10
                  business days, depending on your bank or card issuer.
                </Text>
              </Row>

              {orderUrl && (
                <Row className="mt-2 mb-6">
                  <Button href={orderUrl}>
                    <Text className="text-md font-semibold">
                      View your order
                    </Text>
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

RefundConfirmation.PreviewProps = {
  orderNumber: "1042",
  refundAmount: "$25.00",
  refundDate: "March 16, 2026",
  refundReason: "Item damaged",
  orderUrl: "http://localhost:3000/account/orders/order_01ABC",
} satisfies RefundConfirmationProps;

export default RefundConfirmation;
