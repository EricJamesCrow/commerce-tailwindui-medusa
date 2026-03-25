import { MedusaError } from "@medusajs/framework/utils";
import { createStep } from "@medusajs/framework/workflows-sdk";

type Input = {
  variant_id: string;
  sales_channel_id: string;
  wishlist_items: { product_variant_id: string }[];
};

export const validateVariantWishlistStep = createStep(
  "validate-variant-in-wishlist",
  async (
    { variant_id, sales_channel_id, wishlist_items }: Input,
    { container },
  ) => {
    const isInWishlist = wishlist_items.some(
      (item) => item.product_variant_id === variant_id,
    );

    if (isInWishlist) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Variant is already in wishlist",
      );
    }

    const query = container.resolve("query");
    const { data } = await query.graph({
      entity: "variant",
      fields: ["product.sales_channels.*"],
      filters: { id: variant_id },
    });

    if (!data.length) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Variant not found");
    }

    const salesChannels = data[0].product?.sales_channels ?? [];
    const variantInSalesChannel = salesChannels.some(
      (sc) => sc?.id === sales_channel_id,
    );

    if (!variantInSalesChannel) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Variant is not available in the specified sales channel",
      );
    }
  },
);
