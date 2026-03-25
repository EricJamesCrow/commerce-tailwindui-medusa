// backend/src/modules/resend/templates/_commerce/order-summary.tsx
import { Column, Row, Section } from "@react-email/components";
import { Text } from "../_components/text";

export interface OrderSummaryProps {
  subtotal: string;
  shipping: string;
  discount?: string;
  tax?: string;
  total: string;
}

export const OrderSummary = ({
  subtotal,
  shipping,
  discount,
  tax,
  total,
}: OrderSummaryProps) => {
  return (
    <Section className="my-6 rounded-lg border border-solid border-secondary bg-secondary p-4">
      <Row className="py-1">
        <Column className="w-[70%]">
          <Text className="m-0 text-sm text-tertiary">Subtotal</Text>
        </Column>
        <Column className="w-[30%]" align="right">
          <Text className="m-0 text-sm text-primary">{subtotal}</Text>
        </Column>
      </Row>
      <Row className="py-1">
        <Column className="w-[70%]">
          <Text className="m-0 text-sm text-tertiary">Shipping</Text>
        </Column>
        <Column className="w-[30%]" align="right">
          <Text className="m-0 text-sm text-primary">{shipping}</Text>
        </Column>
      </Row>
      {discount && (
        <Row className="py-1">
          <Column className="w-[70%]">
            <Text className="m-0 text-sm text-tertiary">Discount</Text>
          </Column>
          <Column className="w-[30%]" align="right">
            <Text className="m-0 text-sm text-success-primary">
              -{discount}
            </Text>
          </Column>
        </Row>
      )}
      {tax && (
        <Row className="py-1">
          <Column className="w-[70%]">
            <Text className="m-0 text-sm text-tertiary">Tax</Text>
          </Column>
          <Column className="w-[30%]" align="right">
            <Text className="m-0 text-sm text-primary">{tax}</Text>
          </Column>
        </Row>
      )}
      <Row className="border-t border-solid border-secondary pt-3 mt-2">
        <Column className="w-[70%]">
          <Text className="m-0 text-md font-semibold text-primary">Total</Text>
        </Column>
        <Column className="w-[30%]" align="right">
          <Text className="m-0 text-md font-semibold text-primary">
            {total}
          </Text>
        </Column>
      </Row>
    </Section>
  );
};
