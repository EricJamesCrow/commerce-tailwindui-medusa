import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { MedusaError } from "@medusajs/framework/utils";
import {
  useQueryGraphStep,
  sendNotificationsStep,
  updateCartsStep,
} from "@medusajs/medusa/core-flows";
import { generateCartRecoveryTokenStep } from "../steps/generate-cart-recovery-token";
import { formatCartForEmailStep } from "../steps/format-cart-for-email";
import { EmailTemplates } from "../../modules/resend/templates/template-registry";

type SendAbandonedCartEmailInput = {
  cart_id: string;
};

// Explicit cart shape used throughout the workflow to avoid TS2590 union explosion
type CartData = {
  id: string;
  email: string;
  currency_code: string;
  item_subtotal: number;
  metadata: Record<string, unknown> | null;
  customer?: { first_name?: string };
  items: Record<string, unknown>[];
};

export const sendAbandonedCartEmailWorkflow = createWorkflow(
  "send-abandoned-cart-email",
  function (input: SendAbandonedCartEmailInput) {
    const { data: carts } = useQueryGraphStep({
      entity: "cart",
      fields: [
        "id",
        "email",
        "currency_code",
        "items.*",
        "items.variant.*",
        "items.variant.product.*",
        "metadata",
        "customer.first_name",
        "item_subtotal",
      ],
      filters: { id: input.cart_id },
    });

    // Cast to CartData immediately to avoid TS2590 from the deep Medusa query union
    const cart = transform({ carts }, ({ carts: result }): CartData => {
      const c = result[0] as unknown as CartData;
      if (!c?.email) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Cart has no email address, cannot send abandoned cart notification",
        );
      }
      return c;
    });

    const recoveryToken = generateCartRecoveryTokenStep({
      cart_id: input.cart_id,
    });

    // Extract just the URL string to avoid TS2590 from deep union types
    const recoveryUrl = transform(
      { recoveryToken },
      ({ recoveryToken: rt }) => rt.recoveryUrl,
    );

    const formatInput = transform(
      { cart, recoveryUrl },
      ({ cart: c, recoveryUrl: url }) => ({
        cart: c as Record<string, unknown>,
        recoveryUrl: url,
      }),
    );

    const formatted = formatCartForEmailStep(formatInput);

    const notifications = transform(
      { formatted, cart },
      ({ formatted: data, cart: c }) => [
        {
          to: c.email.toLowerCase(),
          channel: "email" as const,
          template: EmailTemplates.ABANDONED_CART,
          data,
          trigger_type: "cart.abandoned",
          resource_id: c.id,
          resource_type: "cart",
        },
      ],
    );

    sendNotificationsStep(notifications);

    const cartUpdate = transform({ cart }, ({ cart: c }) => [
      {
        id: c.id,
        metadata: {
          ...(c.metadata || {}),
          abandoned_cart_notified: new Date().toISOString(),
        },
      },
    ]);

    updateCartsStep(cartUpdate);

    return new WorkflowResponse({ cart_id: input.cart_id });
  },
);
