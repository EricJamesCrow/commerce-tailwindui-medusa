import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { Container, Heading, Text, Button } from "@medusajs/ui";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { sdk } from "../lib/sdk";
import type { DetailWidgetProps, AdminOrder } from "@medusajs/types";

type Invoice = {
  id: string;
  display_id: number;
  order_id: string;
  year: number;
  generated_at: string;
};

type InvoiceListResponse = {
  invoices: Invoice[];
};

function formatInvoiceNumber(year: number, displayId: number): string {
  return `INV-${year}-${String(displayId).padStart(4, "0")}`;
}

function parseFilenameFromHeader(header: string | null): string {
  if (!header) return "invoice.pdf";
  const match = header.match(/filename="?([^";\s]+)"?/);
  return match?.[1] ?? "invoice.pdf";
}

const OrderInvoiceWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const { data, isLoading, isError } = useQuery<InvoiceListResponse>({
    queryKey: ["order-invoices", order.id],
    queryFn: () =>
      sdk.client.fetch(`/admin/invoices`, {
        query: { order_id: order.id },
      }),
  });

  const invoice = data?.invoices?.[0];
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const backendUrl =
        (typeof __BACKEND_URL__ !== "undefined" && __BACKEND_URL__) ||
        "http://localhost:9000";
      const res = await fetch(
        `${backendUrl}/admin/orders/${order.id}/invoice`,
        {
          credentials: "include",
        },
      );
      if (!res.ok) throw new Error("Failed to download invoice");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = parseFilenameFromHeader(
        res.headers.get("content-disposition"),
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Invoice download failed:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  function renderContent() {
    if (isLoading) {
      return <Text className="text-ui-fg-subtle">Loading...</Text>;
    }
    if (isError) {
      return (
        <Text className="text-ui-fg-error">Failed to load invoice data</Text>
      );
    }
    if (invoice) {
      return (
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
            isLoading={isDownloading}
          >
            Download Invoice
          </Button>
        </>
      );
    }
    return (
      <>
        <Text className="text-ui-fg-subtle">No invoice generated</Text>
        <Button
          variant="secondary"
          size="small"
          onClick={handleDownload}
          isLoading={isDownloading}
        >
          Generate & Download Invoice
        </Button>
      </>
    );
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Invoice</Heading>
      </div>
      <div className="flex flex-col gap-3 px-6 py-4">{renderContent()}</div>
    </Container>
  );
};

export const config = defineWidgetConfig({
  zone: "order.details.side.before",
});

export default OrderInvoiceWidget;
