import { getCollections } from "lib/medusa";
import { Suspense } from "react";
import { MobileFilters } from "./mobile-filters";

async function MobileFiltersList() {
  const collections = await getCollections();
  const collectionsWithHandles = collections.map((collection) => ({
    name: collection.title,
    handle: collection.handle,
  }));

  return <MobileFilters collections={collectionsWithHandles} />;
}

export default function MobileFiltersWrapper() {
  return (
    <Suspense fallback={null}>
      <MobileFiltersList />
    </Suspense>
  );
}
