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
import { formatRefundForEmailStep } from "../steps/format-refund-for-email";
import { EmailTemplates } from "../../modules/resend/templates/template-registry";

type SendRefundConfirmationInput = {
  paymentId: string;
};

export const sendRefundConfirmationWorkflow = createWorkflow(
  "send-refund-confirmation",
  function (input: SendRefundConfirmationInput) {
    const { data: payments } = useQueryGraphStep({
      entity: "payment",
      fields: [
        "id",
        "amount",
        "currency_code",
        "refunds.id",
        "refunds.amount",
        "refunds.created_at",
        "refunds.note",
        "refunds.refund_reason.label",
        "payment_collection.order.id",
        "payment_collection.order.display_id",
        "payment_collection.order.email",
      ],
      filters: { id: input.paymentId },
    });

    const payment = transform({ payments }, ({ payments: result }) => {
      const p = result[0];
      if (!p) {
        throw new MedusaError(MedusaError.Types.NOT_FOUND, "Payment not found");
      }
      return p;
    });

    const formatted = formatRefundForEmailStep({ payment });

    // Gracefully skip if payment can't be traced to an order (orphan payment).
    // Don't throw — refunds can exist without orders in edge cases.
    const notifications = transform({ formatted }, ({ formatted: data }) => {
      if (!data.email) {
        return [];
      }

      const storefrontUrl =
        process.env.STOREFRONT_URL || "http://localhost:3000";

      return [
        {
          to: data.email,
          channel: "email" as const,
          template: EmailTemplates.REFUND_CONFIRMATION,
          data: {
            subject: `Refund issued for order #${data.orderNumber}`,
            orderNumber: data.orderNumber,
            refundAmount: data.refundAmount,
            refundDate: data.refundDate,
            refundReason: data.refundReason,
            orderUrl: data.orderId
              ? `${storefrontUrl}/account/orders/${data.orderId}`
              : undefined,
          },
          trigger_type: "payment.refunded",
          resource_id: data.paymentId,
          resource_type: "payment",
        },
      ];
    });

    sendNotificationsStep(notifications);

    return new WorkflowResponse({
      paymentId: input.paymentId,
    });
  },
);
