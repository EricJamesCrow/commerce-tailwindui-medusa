import { StyleSheet } from "@react-pdf/renderer";

export const colors = {
  primary: "#111827", // gray-900
  secondary: "#6b7280", // gray-500
  tertiary: "#9ca3af", // gray-400
  accent: "#4f46e5", // indigo-600
  background: "#fafafa", // gray-50
  tableHeader: "#f3f4f6", // gray-100
  border: "#e5e7eb", // gray-200
  totalsBackground: "#f9fafb",
  white: "#ffffff",
};

export const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: colors.primary,
    backgroundColor: colors.white,
  },
  headerSection: { marginBottom: 28 },
  invoiceLabel: {
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 2,
    color: colors.accent,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  invoiceNumber: {
    fontSize: 24,
    fontFamily: "Helvetica",
    fontWeight: 300,
    color: colors.primary,
    letterSpacing: -0.5,
  },
  headerMeta: { fontSize: 9, color: colors.tertiary, marginTop: 2 },
  partiesSection: { flexDirection: "row", gap: 40, marginBottom: 24 },
  partyColumn: { flex: 1 },
  partyLabel: {
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.tertiary,
    marginBottom: 6,
  },
  partyName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    marginBottom: 2,
  },
  partyDetail: { fontSize: 9, color: colors.secondary, lineHeight: 1.4 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.tableHeader,
    borderRadius: 4,
    padding: "8 12",
    marginBottom: 2,
  },
  tableHeaderText: {
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.secondary,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: "10 12",
    borderBottomWidth: 1,
    borderBottomColor: colors.tableHeader,
  },
  tableRowLast: {
    flexDirection: "row",
    alignItems: "center",
    padding: "10 12",
  },
  itemName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
  },
  itemDetail: { fontSize: 8, color: colors.tertiary, marginTop: 2 },
  itemText: { fontSize: 10, color: colors.secondary, marginTop: -3 },
  itemTotal: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    marginTop: -3,
  },
  colDescription: { flex: 3 },
  colQty: { flex: 1, textAlign: "center" },
  colUnitPrice: { flex: 1, textAlign: "right" },
  colAmount: { flex: 1, textAlign: "right" },
  totalsContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 16,
  },
  totalsCard: {
    width: 200,
    backgroundColor: colors.totalsBackground,
    borderRadius: 6,
    padding: 12,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  totalsLabel: { fontSize: 10, color: colors.secondary },
  totalsValue: { fontSize: 10, color: colors.secondary },
  totalsDivider: {
    borderTopWidth: 1.5,
    borderTopColor: colors.border,
    marginTop: 4,
    paddingTop: 6,
  },
  totalLabel: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
  },
  totalValue: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
  },
  footerSection: {
    marginTop: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.tableHeader,
  },
  footerText: { fontSize: 8, color: colors.tertiary },
  footerContact: { fontSize: 8, color: colors.tertiary, marginTop: 2 },
});
