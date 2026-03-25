import { Document, Page } from "@react-pdf/renderer";
import { styles } from "./styles";
import { Header } from "./components/header";
import { Parties } from "./components/parties";
import { LineItems } from "./components/line-items";
import { Totals } from "./components/totals";
import { Footer } from "./components/footer";

export interface InvoiceDocumentProps {
  invoiceNumber: string;
  issuedDate: string;
  orderDisplayId: string;
  company: {
    name: string;
    address: string;
    phone?: string;
    email: string;
    logo?: string;
    taxId?: string;
  };
  customer: {
    name: string;
    address: string;
    email: string;
  };
  items: {
    name: string;
    variant?: string;
    sku?: string;
    thumbnail?: string;
    quantity: number;
    unitPrice: string;
    total: string;
  }[];
  subtotal: string;
  shipping: string;
  discount?: string;
  tax: string;
  total: string;
  currency: string;
  notes?: string;
}

export function InvoiceDocument(props: InvoiceDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Header
          invoiceNumber={props.invoiceNumber}
          issuedDate={props.issuedDate}
          orderDisplayId={props.orderDisplayId}
          logo={props.company.logo}
        />
        <Parties
          from={{
            name: props.company.name,
            address: props.company.address,
            phone: props.company.phone,
            email: props.company.email,
            taxId: props.company.taxId,
          }}
          billTo={{
            name: props.customer.name,
            address: props.customer.address,
            email: props.customer.email,
          }}
        />
        <LineItems items={props.items} />
        <Totals
          subtotal={props.subtotal}
          shipping={props.shipping}
          discount={props.discount}
          tax={props.tax}
          total={props.total}
        />
        <Footer companyEmail={props.company.email} notes={props.notes} />
      </Page>
    </Document>
  );
}
