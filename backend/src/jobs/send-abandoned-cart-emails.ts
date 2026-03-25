import { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import * as Sentry from "@sentry/node";
import { sendAbandonedCartEmailWorkflow } from "../workflows/notifications/send-abandoned-cart-email";

type AbandonedCartRow = {
  id: string;
  email: string;
  customer_id: string | null;
  items: unknown[];
  metadata: Record<string, unknown> | null;
  updated_at: string;
};

export default async function abandonedCartJob(container: MedusaContainer) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const logger = container.resolve("logger");

  const startTime = Date.now();
  const limit = 100;
  let offset = 0;
  let totalSent = 0;
  let totalErrors = 0;

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

  // Resolve analytics module once — avoids N throw/catch cycles in the loop
  let analytics: any = null;
  try {
    analytics = container.resolve(Modules.ANALYTICS);
  } catch {
    logger.debug(
      "[analytics] Module not registered; skipping abandoned_cart_email_sent tracking",
    );
  }

  logger.info("Starting abandoned cart email job...");

  try {
    do {
      const { data: carts } = await query.graph({
        entity: "cart",
        fields: [
          "id",
          "email",
          "customer_id",
          "items.*",
          "metadata",
          "updated_at",
        ],
        filters: {
          completed_at: null,
          updated_at: {
            $lt: oneHourAgo,
            $gt: fortyEightHoursAgo,
          },
          email: { $ne: null },
        },
        pagination: { skip: offset, take: limit },
      });

      const eligibleCarts = (carts as AbandonedCartRow[]).filter(
        (cart) =>
          cart.items?.length > 0 && !cart.metadata?.abandoned_cart_notified,
      );

      for (const cart of eligibleCarts) {
        try {
          await sendAbandonedCartEmailWorkflow(container).run({
            input: { cart_id: cart.id },
          });
          totalSent++;
          if (analytics) {
            try {
              const hoursAbandoned = Math.round(
                (Date.now() - new Date(cart.updated_at).getTime()) /
                  (1000 * 60 * 60),
              );
              await analytics.track({
                event: "abandoned_cart_email_sent",
                actor_id: cart.customer_id ?? `cart_${cart.id}`,
                properties: {
                  cart_id: cart.id,
                  hours_abandoned: hoursAbandoned,
                  item_count: cart.items?.length ?? 0,
                },
              });
            } catch (analyticsError) {
              logger.debug(
                `[analytics] Skipped abandoned_cart_email_sent for cart ${cart.id}: ${analyticsError}`,
              );
            }
          }
          logger.info(`Sent abandoned cart email for cart ${cart.id}`);
        } catch (error: any) {
          totalErrors++;
          Sentry.captureException(error, {
            tags: { job: "abandoned_cart_emails", cart_id: cart.id },
          });
          logger.error(
            `Failed to send abandoned cart email for cart ${cart.id}: ${error?.message}`,
          );
        }
      }

      offset += limit;
      if (carts.length < limit) break; // No more pages
    } while (true);

    const duration = Date.now() - startTime;
    logger.info(
      `Abandoned cart job complete: ${totalSent} sent, ${totalErrors} errors in ${duration}ms`,
    );
  } catch (error: any) {
    Sentry.captureException(error, {
      tags: { job: "abandoned_cart_emails", step: "main" },
    });
    logger.error(`Abandoned cart job failed: ${error?.message}`);
  }
}

export const config = {
  name: "send-abandoned-cart-emails",
  schedule: "*/15 * * * *",
};
