import { View, Text } from "@react-pdf/renderer"
import { styles } from "../styles"

interface TotalsProps {
  subtotal: string
  shipping: string
  discount?: string
  tax: string
  total: string
}

export function Totals({ subtotal, shipping, discount, tax, total }: TotalsProps) {
  return (
    <View style={styles.totalsContainer}>
      <View style={styles.totalsCard}>
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Subtotal</Text>
          <Text style={styles.totalsValue}>{subtotal}</Text>
        </View>
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Shipping</Text>
          <Text style={styles.totalsValue}>{shipping}</Text>
        </View>
        {discount && (
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Discount</Text>
            <Text style={styles.totalsValue}>-{discount}</Text>
          </View>
        )}
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Tax</Text>
          <Text style={styles.totalsValue}>{tax}</Text>
        </View>
        <View style={[styles.totalsRow, styles.totalsDivider]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{total}</Text>
        </View>
      </View>
    </View>
  )
}
