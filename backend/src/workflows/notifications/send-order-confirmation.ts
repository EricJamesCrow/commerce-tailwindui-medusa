import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import {
  useQueryGraphStep,
  sendNotificationsStep,
} from "@medusajs/medusa/core-flows"
import { formatOrderForEmailStep } from "../steps/format-order-for-email"
import { tryGenerateInvoicePdfStep } from "../steps/try-generate-invoice-pdf"
import { EmailTemplates } from "../../modules/resend/templates/template-registry"

type SendOrderConfirmationInput = {
  id: string
}

export const sendOrderConfirmationWorkflow = createWorkflow(
  "send-order-confirmation",
  function (input: SendOrderConfirmationInput) {
    const { data: orders } = useQueryGraphStep({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "email",
        "created_at",
        "currency_code",
        "items.*",
        "shipping_address.*",
        "billing_address.*",
        "total",
        "subtotal",
        "item_total",
        "item_subtotal",
        "shipping_total",
        "tax_total",
        "discount_total",
      ],
      filters: { id: input.id },
    })

    const order = transform({ orders }, ({ orders: result }) => {
      const o = result[0]
      if (!o?.email) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Order has no email address, cannot send confirmation"
        )
      }
      return o
    })

    const formatted = formatOrderForEmailStep({ order })

    // Fetch invoice config to check attach_to_email toggle
    const { data: invoiceConfigs } = useQueryGraphStep({
      entity: "invoice_config",
      fields: ["attach_to_email"],
    }).config({ name: "fetch-invoice-config-for-email" })

    const attachToEmail = transform(
      { invoiceConfigs },
      ({ invoiceConfigs: configs }) => {
        const config = configs[0] as Record<string, any> | undefined
        return config?.attach_to_email === true
      }
    )

    // Conditionally generate invoice PDF when attach_to_email is enabled.
    // tryGenerateInvoicePdfStep handles all errors internally and returns
    // { buffer: null } on failure, so this never blocks the confirmation email.
    const invoicePdfResult = when(
      { attachToEmail },
      (data) => data.attachToEmail === true
    ).then(function () {
      return tryGenerateInvoicePdfStep({
        order_id: input.id,
        order,
      })
    })

    const notifications = transform(
      { formatted, attachToEmail, invoicePdfResult },
      ({
        formatted: data,
        attachToEmail: shouldAttach,
        invoicePdfResult: pdfResult,
      }) => {
        const storefrontUrl =
          process.env.STOREFRONT_URL || "http://localhost:3000"

        const invoiceDownloadUrl = `${storefrontUrl}/api/orders/${data.orderId}/invoice`

        // Determine invoice mode based on whether we have a PDF buffer
        const hasPdf = shouldAttach && pdfResult?.buffer != null
        const invoiceMode = hasPdf ? ("attachment" as const) : ("link" as const)

        // Build base notification data
        const notificationData: Record<string, unknown> = {
          subject: `Order Confirmed - #${data.orderNumber}`,
          customerName: data.customerName,
          orderNumber: data.orderNumber,
          orderDate: data.orderDate,
          items: data.items,
          subtotal: data.subtotal,
          shipping: data.shipping,
          tax: data.tax,
          discount: data.discount,
          total: data.total,
          paymentMethod: data.paymentMethod,
          shippingAddress: data.shippingAddress,
          orderStatusUrl: `${storefrontUrl}/account/orders/${data.orderId}`,
          invoiceMode,
          invoiceDownloadUrl,
        }

        // When mode is "attachment", include the PDF via data.attachments
        // (handled by our Resend notification service)
        if (hasPdf) {
          notificationData.attachments = [
            {
              content: pdfResult.buffer,
              filename: `invoice-${pdfResult.invoiceNumber || data.orderNumber}.pdf`,
            },
          ]
        }

        return [
          {
            to: data.email,
            channel: "email" as const,
            template: EmailTemplates.ORDER_CONFIRMATION,
            data: notificationData,
            trigger_type: "order.placed",
            resource_id: data.orderId,
            resource_type: "order",
          },
        ]
      }
    )

    sendNotificationsStep(notifications)

    return new WorkflowResponse({
      orderId: input.id,
    })
  }
)
