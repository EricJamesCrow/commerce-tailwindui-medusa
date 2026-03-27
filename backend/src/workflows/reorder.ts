import {
  createWorkflow,
  WorkflowResponse,
  transform,
} from "@medusajs/framework/workflows-sdk";
import { CreateCartWorkflowInput } from "@medusajs/core-flows";
import {
  useQueryGraphStep,
  createCartWorkflow,
  addShippingMethodToCartWorkflow,
} from "@medusajs/medusa/core-flows";

type ReorderWorkflowInput = {
  orderId: string;
  customerId: string;
};

/**
 * Maps a nullable address from an order to the CreateCartAddressDTO shape,
 * converting null fields to undefined so the types are compatible.
 */
function mapAddress(
  addr: Record<string, unknown> | null | undefined,
): import("@medusajs/types").CreateCartAddressDTO | undefined {
  if (!addr) return undefined;
  return {
    first_name: (addr.first_name as string | null) ?? undefined,
    last_name: (addr.last_name as string | null) ?? undefined,
    phone: (addr.phone as string | null) ?? undefined,
    company: (addr.company as string | null) ?? undefined,
    address_1: (addr.address_1 as string | null) ?? undefined,
    address_2: (addr.address_2 as string | null) ?? undefined,
    city: (addr.city as string | null) ?? undefined,
    country_code: (addr.country_code as string | null) ?? undefined,
    province: (addr.province as string | null) ?? undefined,
    postal_code: (addr.postal_code as string | null) ?? undefined,
  };
}

export const reorderWorkflow = createWorkflow(
  "reorder",
  (input: ReorderWorkflowInput) => {
    // Step 1: Retrieve original order
    const { data: orders } = useQueryGraphStep({
      entity: "order",
      fields: [
        "id",
        "region_id",
        "sales_channel_id",
        "currency_code",
        "email",
        "items.*",
        "items.variant_id",
        "shipping_address.*",
        "billing_address.*",
        "shipping_methods.*",
        "shipping_methods.shipping_option_id",
      ],
      filters: { id: input.orderId },
    });

    // Step 2: Create new cart from original order data
    const cartInput = transform(
      { orders, input },
      ({ orders, input }): CreateCartWorkflowInput => {
        const order = orders[0]!;
        return {
          region_id: (order.region_id as string | null) ?? undefined,
          sales_channel_id:
            (order.sales_channel_id as string | null) ?? undefined,
          customer_id: input.customerId,
          email: (order.email as string | null) ?? undefined,
          shipping_address: mapAddress(
            order.shipping_address as Record<string, unknown> | null,
          ),
          billing_address: mapAddress(
            order.billing_address as Record<string, unknown> | null,
          ),
          items: ((order.items as Array<unknown> | null) ?? [])
            .filter(
              (item): item is { variant_id: string; quantity: number } =>
                item !== null && item !== undefined,
            )
            .map((item) => ({
              variant_id: item.variant_id,
              quantity: item.quantity,
            })),
        };
      },
    );

    const { id: cartId } = createCartWorkflow.runAsStep({
      input: cartInput,
    });

    // Step 3: Apply original shipping method
    const shippingInput = transform(
      { orders, cartId },
      ({ orders, cartId }) => {
        const order = orders[0]!;
        return {
          cart_id: cartId,
          options: ((order.shipping_methods as Array<unknown> | null) ?? [])
            .filter(
              (method): method is { shipping_option_id: string } =>
                method !== null &&
                method !== undefined &&
                typeof (method as { shipping_option_id?: unknown })
                  .shipping_option_id === "string" &&
                !!(method as { shipping_option_id: string }).shipping_option_id,
            )
            .map((method) => ({
              id: method.shipping_option_id,
            })),
        };
      },
    );

    addShippingMethodToCartWorkflow.runAsStep({
      input: shippingInput,
    });

    // Step 4: Retrieve new cart's full details
    const { data: carts } = useQueryGraphStep({
      entity: "cart",
      fields: ["id", "items.*", "total", "currency_code"],
      filters: { id: cartId },
    });

    const cart = transform({ carts }, ({ carts }) => {
      const c = carts[0]!;
      return {
        id: c.id as string,
        currency_code: c.currency_code as string,
      };
    });

    return new WorkflowResponse({ cart, cart_id: cartId });
  },
);
