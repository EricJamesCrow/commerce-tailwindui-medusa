// backend/src/modules/resend/templates/_commerce/item-table.tsx
import { Column, Img, Row, Section } from "@react-email/components";
import { Text } from "../_components/text";
import type { CommerceLineItem } from "../types";

export interface ItemTableProps {
  items: CommerceLineItem[];
}

export const ItemTable = ({ items }: ItemTableProps) => {
  return (
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
            <table cellPadding="0" cellSpacing="0" border={0}>
              <tbody>
                <tr>
                  {item.imageUrl && (
                    <td style={{ verticalAlign: "middle", paddingRight: 12, width: 64 }}>
                      <Img
                        src={item.imageUrl}
                        alt={item.name}
                        width="64"
                        height="64"
                        style={{
                          borderRadius: 8,
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    </td>
                  )}
                  <td style={{ verticalAlign: "middle" }}>
                    <Text className="m-0 text-sm text-primary">
                      {item.name}
                    </Text>
                    {item.variant && (
                      <Text className="m-0 text-xs text-tertiary">
                        {item.variant}
                      </Text>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
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
  );
};
