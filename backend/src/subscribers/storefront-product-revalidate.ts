import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework";
import { triggerStorefrontCatalogRevalidation } from "./_helpers/revalidate-storefront";

export default async function storefrontProductRevalidateHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  await triggerStorefrontCatalogRevalidation({
    container,
    resourceId: data.id,
    resourceType: "product",
  });
}

export const config: SubscriberConfig = {
  event: ["product.created", "product.updated", "product.deleted"],
};
