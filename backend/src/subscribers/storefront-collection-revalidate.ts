import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework";
import { triggerStorefrontCatalogRevalidation } from "./_helpers/revalidate-storefront";

export default async function storefrontCollectionRevalidateHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  await triggerStorefrontCatalogRevalidation({
    container,
    resourceId: data.id,
    resourceType: "collection",
  });
}

export const config: SubscriberConfig = {
  event: [
    "product-collection.created",
    "product-collection.updated",
    "product-collection.deleted",
  ],
};
