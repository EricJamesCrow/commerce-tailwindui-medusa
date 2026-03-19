import { View, Text } from "@react-pdf/renderer"
import { styles } from "../styles"

interface FooterProps {
  companyEmail: string
  notes?: string
}

export function Footer({ companyEmail, notes }: FooterProps) {
  return (
    <View style={styles.footerSection}>
      <Text style={styles.footerText}>
        {notes || "Thank you for your purchase."}
      </Text>
      <Text style={styles.footerContact}>
        Questions? Contact {companyEmail}
      </Text>
    </View>
  )
}
