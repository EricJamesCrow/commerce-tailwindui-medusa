import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import * as Sentry from "@sentry/node";
import { sendPasswordResetEmailWorkflow } from "../workflows/notifications/send-password-reset-email";

type PasswordResetPayload = {
  entity_id: string; // This IS the email address (renamed from `email` after v2.0.7)
  actor_type: string;
  token: string;
};

export default async function passwordResetHandler({
  event: { data },
  container,
}: SubscriberArgs<PasswordResetPayload>) {
  const logger = container.resolve("logger");

  try {
    const email = data.entity_id?.trim();
    const token = data.token?.trim();
    const actorType = data.actor_type;

    if (!email || !token) {
      logger.warn(
        "Password reset payload missing email or token, skipping notification",
      );
      return;
    }

    if (actorType !== "customer" && actorType !== "user") {
      logger.warn(
        `Password reset payload has unsupported actor type "${String(actorType)}", skipping notification`,
      );
      return;
    }

    await sendPasswordResetEmailWorkflow(container).run({
      input: { email, token, actorType },
    });
    logger.info(`Password reset email sent (${actorType})`);
  } catch (error) {
    Sentry.captureException(error, {
      tags: { subscriber: "password_reset", actor_type: data.actor_type },
    });
    logger.error(
      `Failed to send password reset email (${data.actor_type})`,
      error,
    );
  }
}

export const config: SubscriberConfig = {
  event: "auth.password_reset",
};
