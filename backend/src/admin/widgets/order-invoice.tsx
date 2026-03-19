import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Button } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { sdk } from "../lib/sdk"
import type { DetailWidgetProps, AdminOrder } from "@medusajs/types"

type Invoice = {
  id: string
  display_id: number
  order_id: string
  year: number
  generated_at: string
}

type InvoiceListResponse = {
  invoices: Invoice[]
}

const formatInvoiceNumber = (year: number, displayId: number) =>
  `INV-${year}-${String(displayId).padStart(4, "0")}`

const OrderInvoiceWidget = ({
  data: order,
}: DetailWidgetProps<AdminOrder>) => {
  const { data, isLoading } = useQuery<InvoiceListResponse>({
    queryKey: ["order-invoices", order.id],
    queryFn: () =>
      sdk.client.fetch(`/admin/invoices`, {
        query: { order_id: order.id },
      }),
  })

  const invoice = data?.invoices?.[0]

  const handleDownload = () => {
    // Open the PDF download endpoint in a new tab
    const backendUrl =
      (typeof __BACKEND_URL__ !== "undefined" && __BACKEND_URL__) ||
      "http://localhost:9000"
    window.open(
      `${backendUrl}/admin/orders/${order.id}/invoice`,
      "_blank"
    )
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Invoice</Heading>
      </div>
      <div className="flex flex-col gap-3 px-6 py-4">
        {isLoading ? (
          <Text className="text-ui-fg-subtle">Loading...</Text>
        ) : invoice ? (
          <>
            <Text>
              Invoice{" "}
              <span className="font-medium">
                {formatInvoiceNumber(invoice.year, invoice.display_id)}
              </span>
            </Text>
            <Button
              variant="secondary"
              size="small"
              onClick={handleDownload}
            >
              Download Invoice
            </Button>
          </>
        ) : (
          <>
            <Text className="text-ui-fg-subtle">No invoice generated</Text>
            <Button
              variant="secondary"
              size="small"
              onClick={handleDownload}
            >
              Generate & Download Invoice
            </Button>
          </>
        )}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.side.before",
})

export default OrderInvoiceWidget
