import { View, Text, Image } from "@react-pdf/renderer";
import { styles, colors } from "../styles";

interface LineItem {
  name: string;
  variant?: string;
  sku?: string;
  thumbnail?: string;
  quantity: number;
  unitPrice: string;
  total: string;
}

interface LineItemsProps {
  items: LineItem[];
}

export function LineItems({ items }: LineItemsProps) {
  return (
    <View>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderText, styles.colDescription]}>
          Item
        </Text>
        <Text style={[styles.tableHeaderText, styles.colQty]}>Qty</Text>
        <Text style={[styles.tableHeaderText, styles.colUnitPrice]}>
          Unit Price
        </Text>
        <Text style={[styles.tableHeaderText, styles.colAmount]}>Amount</Text>
      </View>
      {items.map((item, index) => (
        <View
          key={index}
          style={
            index < items.length - 1 ? styles.tableRow : styles.tableRowLast
          }
        >
          <View
            style={[
              styles.colDescription,
              { flexDirection: "row", alignItems: "center", gap: 8 },
            ]}
          >
            {item.thumbnail && (
              <Image
                src={item.thumbnail}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 3,
                  objectFit: "cover",
                  border: `1 solid ${colors.border}`,
                }}
              />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              {(item.variant || item.sku) && (
                <Text style={styles.itemDetail}>
                  {[item.variant, item.sku].filter(Boolean).join(" · ")}
                </Text>
              )}
            </View>
          </View>
          <Text style={[styles.itemText, styles.colQty]}>{item.quantity}</Text>
          <Text style={[styles.itemText, styles.colUnitPrice]}>
            {item.unitPrice}
          </Text>
          <Text style={[styles.itemTotal, styles.colAmount]}>{item.total}</Text>
        </View>
      ))}
    </View>
  );
}
