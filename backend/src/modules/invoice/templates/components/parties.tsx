import { View, Text } from "@react-pdf/renderer";
import { styles } from "../styles";

interface PartyInfo {
  name: string;
  address: string;
  email: string;
  phone?: string;
  taxId?: string;
}

interface PartiesProps {
  from: PartyInfo;
  billTo: PartyInfo;
}

export function Parties({ from, billTo }: PartiesProps) {
  return (
    <View style={styles.partiesSection}>
      <View style={styles.partyColumn}>
        <Text style={styles.partyLabel}>From</Text>
        <Text style={styles.partyName}>{from.name}</Text>
        <Text style={styles.partyDetail}>{from.address}</Text>
        {from.phone && <Text style={styles.partyDetail}>{from.phone}</Text>}
        <Text style={styles.partyDetail}>{from.email}</Text>
        {from.taxId && (
          <Text style={styles.partyDetail}>Tax ID: {from.taxId}</Text>
        )}
      </View>
      <View style={styles.partyColumn}>
        <Text style={styles.partyLabel}>Bill To</Text>
        <Text style={styles.partyName}>{billTo.name}</Text>
        <Text style={styles.partyDetail}>{billTo.address}</Text>
        {billTo.phone && <Text style={styles.partyDetail}>{billTo.phone}</Text>}
        <Text style={styles.partyDetail}>{billTo.email}</Text>
      </View>
    </View>
  );
}
