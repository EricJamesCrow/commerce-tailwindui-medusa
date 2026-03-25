import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { MedusaError } from "@medusajs/framework/utils";
import {
  useQueryGraphStep,
  sendNotificationsStep,
} from "@medusajs/medusa/core-flows";
import { formatOrderForEmailStep } from "../steps/format-order-for-email";
import { createCurrencyFormatter } from "./_format-helpers";
import { EmailTemplates } from "../../modules/resend/templates/template-registry";

type SendOrderCanceledInput = {
  orderId: string;
};

export const sendOrderCanceledWorkflow = createWorkflow(
  "send-order-canceled",
  function (input: SendOrderCanceledInput) {
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
        "total",
        "item_total",
        "item_subtotal",
        "shipping_total",
        "tax_total",
        "discount_total",
        "payment_collections.payments.refunds.*",
        "payment_collections.payments.amount",
        "payment_collections.payments.currency_code",
      ],
      filters: { id: input.orderId },
    });

    // Extract order and compute refund message together from the raw query result
    // to avoid TypeScript union type complexity from chained transforms
    const { order, refundMessage } = transform(
      { orders },
      ({ orders: result }) => {
        const o = result[0] as Record<string, any>;
        if (!o?.email) {
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            "Order has no email, cannot send cancellation email",
          );
        }

        const currencyCode = o.currency_code || "USD";
        const currencyFormatter = createCurrencyFormatter(currencyCode);

        let refundTotal = 0;
        const paymentCollections = o.payment_collections || [];
        for (const pc of paymentCollections) {
          for (const payment of pc.payments || []) {
            for (const refund of payment.refunds || []) {
              refundTotal += Number(refund.amount) || 0;
            }
          }
        }

        const refundMessage =
          refundTotal > 0
            ? `A refund of ${currencyFormatter.format(refundTotal)} has been issued to your original payment method.`
            : "If you were charged, a refund will be processed shortly.";

        return { order: o, refundMessage };
      },
    );

    const formatted = formatOrderForEmailStep({ order });

    const notifications = transform(
      { formatted, refundMessage },
      ({ formatted: data, refundMessage: msg }) => {
        const storefrontUrl =
          process.env.STOREFRONT_URL || "http://localhost:3000";

        return [
          {
            to: data.email,
            channel: "email" as const,
            template: EmailTemplates.ORDER_CANCELED,
            data: {
              subject: `Your order #${data.orderNumber} has been canceled`,
              customerName: data.customerName,
              orderNumber: data.orderNumber,
              orderDate: data.orderDate,
              items: data.items,
              subtotal: data.subtotal,
              shipping: data.shipping,
              tax: data.tax,
              discount: data.discount,
              total: data.total,
              refundMessage: msg,
              shopUrl: storefrontUrl,
            },
            trigger_type: "order.canceled",
            resource_id: data.orderId,
            resource_type: "order",
          },
        ];
      },
    );

    sendNotificationsStep(notifications);

    return new WorkflowResponse({
      orderId: input.orderId,
    });
  },
);
