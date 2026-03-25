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
import {
  createCurrencyFormatter,
  formatAddress,
  formatItem,
  formatOrderDate,
} from "./_format-helpers";
import { EmailTemplates } from "../../modules/resend/templates/template-registry";

type SendAdminOrderAlertInput = {
  orderId: string;
  adminEmails: string[];
  adminUrl: string;
};

export const sendAdminOrderAlertWorkflow = createWorkflow(
  "send-admin-order-alert",
  function (input: SendAdminOrderAlertInput) {
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
        "item_total",
        "item_subtotal",
        "shipping_total",
        "tax_total",
        "discount_total",
      ],
      filters: { id: input.orderId },
    });

    // Single transform: collapse order lookup + formatting + notification building
    const notifications = transform(
      { orders, input } as {
        orders: Record<string, any>[];
        input: SendAdminOrderAlertInput;
      },
      ({ orders: result, input: inp }) => {
        const o = result[0] as Record<string, any>;
        if (!o) {
          throw new MedusaError(
            MedusaError.Types.NOT_FOUND,
            "Order not found for admin alert",
          );
        }

        const formatter = createCurrencyFormatter(
          (o.currency_code as string) || "USD",
        );
        const fmt = (amount: number) => formatter.format(amount);

        const items = ((o.items || []) as Record<string, any>[]).map((item) =>
          formatItem(item, fmt),
        );

        const sa = o.shipping_address as Record<string, any> | undefined;
        const shippingAddress = formatAddress(sa);
        const billingAddress = o.billing_address
          ? formatAddress(o.billing_address as Record<string, any>)
          : undefined;

        const orderNumber = String(o.display_id || o.id);
        const orderDate = formatOrderDate(o.created_at as string);
        const total = fmt((o.total as number) || 0);

        return inp.adminEmails.map((adminEmail) => ({
          to: adminEmail,
          channel: "email" as const,
          template: EmailTemplates.ADMIN_ORDER_ALERT,
          data: {
            subject: `New order #${orderNumber} — ${total}`,
            orderNumber,
            orderDate,
            customerEmail: o.email as string,
            customerName: sa?.first_name as string | undefined,
            items,
            subtotal: fmt(((o.item_subtotal ?? o.item_total) as number) ?? 0),
            shipping: fmt((o.shipping_total as number) || 0),
            tax: o.tax_total ? fmt(o.tax_total as number) : undefined,
            discount: o.discount_total
              ? fmt(o.discount_total as number)
              : undefined,
            total,
            shippingAddress,
            billingAddress,
            adminOrderUrl: `${inp.adminUrl}/orders/${o.id as string}`,
          },
          trigger_type: "order.placed",
          resource_id: o.id as string,
          resource_type: "order",
        }));
      },
    );

    sendNotificationsStep(notifications);

    return new WorkflowResponse({
      orderId: input.orderId,
    });
  },
);
