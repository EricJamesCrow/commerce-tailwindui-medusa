import { Column, Hr, Row, Section } from "@react-email/components";
import { Text } from "./text";

/**
 * Individual line item
 */
export interface LineItem {
  /** Item name/description */
  name: string;
  /** Quantity */
  quantity?: number;
  /** Formatted price (e.g., "$29.00") */
  price: string;
}

/**
 * Props for LineItems component
 */
export interface LineItemsProps {
  /** Array of line items */
  items: LineItem[];
  /** Subtotal before tax */
  subtotal: string;
  /** Tax amount (optional) */
  tax?: string;
  /** Total amount */
  total: string;
  /** Currency symbol */
  currency?: string;
}

/**
 * Reusable line items component for receipts and invoices.
 * Displays itemized list with subtotal, tax, and total.
 */
export const LineItems = ({ items, subtotal, tax, total }: LineItemsProps) => {
  return (
    <Section className="my-6 rounded-lg border border-solid border-secondary">
      {/* Header */}
      <Row className="border-b border-solid border-secondary bg-secondary px-4 py-3">
        <Column className="w-[60%]">
          <Text className="m-0 text-xs font-medium uppercase text-tertiary">
            Item
          </Text>
        </Column>
        <Column className="w-[20%]" align="center">
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

      {/* Line Items */}
      {items.map((item, index) => (
        <Row
          key={index}
          className={`px-4 py-3 ${index < items.length - 1 ? "border-b border-solid border-secondary" : ""}`}
        >
          <Column className="w-[60%]">
            <Text className="m-0 text-sm text-primary">{item.name}</Text>
          </Column>
          <Column className="w-[20%]" align="center">
            <Text className="m-0 text-sm text-tertiary">
              {item.quantity || 1}
            </Text>
          </Column>
          <Column className="w-[20%]" align="right">
            <Text className="m-0 text-sm text-primary">{item.price}</Text>
          </Column>
        </Row>
      ))}

      {/* Totals */}
      <Row className="border-t border-solid border-secondary px-4 py-3">
        <Column className="w-[80%]">
          <Text className="m-0 text-sm text-tertiary">Subtotal</Text>
        </Column>
        <Column className="w-[20%]" align="right">
          <Text className="m-0 text-sm text-primary">{subtotal}</Text>
        </Column>
      </Row>

      {tax && (
        <Row className="px-4 py-3">
          <Column className="w-[80%]">
            <Text className="m-0 text-sm text-tertiary">Tax</Text>
          </Column>
          <Column className="w-[20%]" align="right">
            <Text className="m-0 text-sm text-primary">{tax}</Text>
          </Column>
        </Row>
      )}

      <Row className="border-t border-solid border-secondary bg-secondary px-4 py-3">
        <Column className="w-[80%]">
          <Text className="m-0 text-md font-semibold text-primary">Total</Text>
        </Column>
        <Column className="w-[20%]" align="right">
          <Text className="m-0 text-md font-semibold text-primary">
            {total}
          </Text>
        </Column>
      </Row>
    </Section>
  );
};

/**
 * Props for PaymentDetails component
 */
export interface PaymentDetailsProps {
  /** Payment method (e.g., "Visa", "Mastercard") */
  method: string;
  /** Last 4 digits of card */
  cardLast4?: string;
  /** Receipt/Invoice number */
  receiptNumber?: string;
  /** Transaction date */
  date?: string;
}

/**
 * Component showing payment method details
 */
export const PaymentDetails = ({
  method,
  cardLast4,
  receiptNumber,
  date,
}: PaymentDetailsProps) => {
  return (
    <Section className="my-6 rounded-lg border border-solid border-secondary bg-secondary p-4">
      <Row>
        <Column>
          <Text className="m-0 text-xs font-medium uppercase text-tertiary">
            Payment Method
          </Text>
          <Text className="m-0 mt-1 text-sm text-primary">
            {method}
            {cardLast4 && ` ending in ${cardLast4}`}
          </Text>
        </Column>
        {receiptNumber && (
          <Column align="right">
            <Text className="m-0 text-xs font-medium uppercase text-tertiary">
              Receipt #
            </Text>
            <Text className="m-0 mt-1 text-sm text-primary">
              {receiptNumber}
            </Text>
          </Column>
        )}
      </Row>
      {date && (
        <Row className="mt-3">
          <Column>
            <Text className="m-0 text-xs font-medium uppercase text-tertiary">
              Date
            </Text>
            <Text className="m-0 mt-1 text-sm text-primary">{date}</Text>
          </Column>
        </Row>
      )}
    </Section>
  );
};
