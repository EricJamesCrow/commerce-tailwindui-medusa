import { getCollections } from "lib/medusa";
import { Suspense } from "react";
import CollectionsList from "./collections-list";

async function CollectionList() {
  const collections = await getCollections();
  const collectionsWithHandles = collections.map((collection) => ({
    name: collection.title,
    handle: collection.handle,
  }));

  return <CollectionsList collections={collectionsWithHandles} />;
}

export default function Collections() {
  return (
    <Suspense
      fallback={
        <div className="hidden lg:block">
          <div className="space-y-4 border-b border-gray-200 pb-6">
            <div className="h-4 w-5/6 animate-pulse rounded-sm bg-gray-200" />
            <div className="h-4 w-4/6 animate-pulse rounded-sm bg-gray-200" />
            <div className="h-4 w-5/6 animate-pulse rounded-sm bg-gray-200" />
            <div className="h-4 w-3/6 animate-pulse rounded-sm bg-gray-200" />
            <div className="h-4 w-5/6 animate-pulse rounded-sm bg-gray-200" />
            <div className="h-4 w-4/6 animate-pulse rounded-sm bg-gray-200" />
            <div className="h-4 w-5/6 animate-pulse rounded-sm bg-gray-200" />
            <div className="h-4 w-4/6 animate-pulse rounded-sm bg-gray-200" />
          </div>
        </div>
      }
    >
      <CollectionList />
    </Suspense>
  );
}
