import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import * as Sentry from "@sentry/node";
import { sendRefundConfirmationWorkflow } from "../workflows/notifications/send-refund-confirmation";
import { trackPaymentRefundedWorkflow } from "../workflows/analytics/track-payment-refunded";

export default async function paymentRefundedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger");

  try {
    await sendRefundConfirmationWorkflow(container).run({
      input: { paymentId: data.id },
    });
    logger.info(`Refund confirmation email sent for payment ${data.id}`);
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        subscriber: "payment_refunded",
        step: "send_email",
        payment_id: data.id,
      },
    });
    logger.error(
      `Failed to send refund confirmation for payment ${data.id}`,
      error,
    );
  }

  try {
    await trackPaymentRefundedWorkflow(container).run({
      input: { payment_id: data.id },
    });
  } catch (error) {
    logger.warn(
      `[analytics] Failed to track payment_refunded for ${data.id}: ${error}`,
    );
  }
}

export const config: SubscriberConfig = {
  event: "payment.refunded",
};
