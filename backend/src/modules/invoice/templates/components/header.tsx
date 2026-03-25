import { View, Text, Image } from "@react-pdf/renderer";
import { styles } from "../styles";

interface HeaderProps {
  invoiceNumber: string;
  issuedDate: string;
  orderDisplayId: string;
  logo?: string;
}

export function Header({
  invoiceNumber,
  issuedDate,
  orderDisplayId,
  logo,
}: HeaderProps) {
  return (
    <View style={styles.headerSection}>
      {logo && (
        <Image
          src={logo}
          style={{
            width: 120,
            height: 40,
            marginBottom: 8,
            objectFit: "contain",
          }}
        />
      )}
      <Text style={styles.invoiceLabel}>Invoice</Text>
      <Text style={styles.invoiceNumber}>{invoiceNumber}</Text>
      <Text style={styles.headerMeta}>
        Issued {issuedDate} · Order {orderDisplayId}
      </Text>
    </View>
  );
}
