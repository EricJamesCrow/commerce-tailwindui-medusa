// backend/src/modules/resend/templates/_commerce/order-status-badge.tsx
import { Section } from "@react-email/components";
import { Text } from "../_components/text";
import { cx } from "../utils/cx";

type OrderStatus = "confirmed" | "shipped" | "delivered" | "canceled";

const statusStyles: Record<OrderStatus, string> = {
  confirmed: "bg-brand-secondary text-brand-secondary",
  shipped: "bg-brand-secondary text-brand-secondary",
  delivered: "bg-success-primary text-success-primary",
  canceled: "bg-error-secondary text-error-primary",
};

const statusLabels: Record<OrderStatus, string> = {
  confirmed: "Order Confirmed",
  shipped: "Shipped",
  delivered: "Delivered",
  canceled: "Canceled",
};

export interface OrderStatusBadgeProps {
  status: OrderStatus;
}

export const OrderStatusBadge = ({ status }: OrderStatusBadgeProps) => {
  return (
    <Section>
      <Text
        className={cx(
          "m-0 inline-block rounded-full px-3 py-1 text-xs font-semibold",
          statusStyles[status]
        )}
      >
        {statusLabels[status]}
      </Text>
    </Section>
  );
};
