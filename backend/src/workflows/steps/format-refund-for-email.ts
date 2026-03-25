import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import {
  createCurrencyFormatter,
  formatOrderDate,
} from "../notifications/_format-helpers";

export type FormattedRefundEmailData = {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  email: string;
  refundAmount: string;
  refundDate: string;
  refundReason?: string;
  currencyCode: string;
};

type FormatRefundForEmailInput = {
  payment: Record<string, any>;
};

export const formatRefundForEmailStep = createStep(
  "format-refund-for-email",
  async (input: FormatRefundForEmailInput) => {
    const { payment } = input;

    const currencyCode = (payment.currency_code as string) || "USD";
    const formatter = createCurrencyFormatter(currencyCode);

    const refunds = (payment.refunds || []) as Record<string, any>[];
    const latestRefund = refunds[refunds.length - 1];

    if (!latestRefund) {
      throw new Error("No refunds found on payment");
    }

    const order =
      payment.payment_collection?.order ||
      (payment as any).payment_collections?.[0]?.order;

    const formatted: FormattedRefundEmailData = {
      paymentId: payment.id,
      orderId: order?.id || "",
      orderNumber: String(order?.display_id || order?.id || ""),
      email: order?.email || "",
      refundAmount: formatter.format(Number(latestRefund.amount) || 0),
      refundDate: formatOrderDate(latestRefund.created_at),
      refundReason: latestRefund.refund_reason?.label || undefined,
      currencyCode,
    };

    return new StepResponse(formatted);
  },
);
