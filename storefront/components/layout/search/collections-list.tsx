"use client";

import clsx from "clsx";
import { redactPiiFromQuery, trackClient } from "lib/analytics";
import { MEILISEARCH_ENABLED } from "lib/meilisearch";
import { createUrl } from "lib/utils";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export default function CollectionsList({
  collections,
}: {
  collections: Array<{ name: string; handle: string }>;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";
  const selectedCollection = searchParams.get("collection") || "";
  const isSearchPage = pathname === "/search" && MEILISEARCH_ENABLED && !!query;

  const buildSearchHref = (overrides: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(overrides)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }

    return createUrl("/search", params);
  };

  return (
    <>
      <h3 className="sr-only">Collections</h3>
      <ul
        role="list"
        className="space-y-4 border-b border-gray-200 pb-6 text-sm font-medium text-gray-900"
      >
        {collections.map((collection) => {
          const href = isSearchPage
            ? buildSearchHref({
                collection: collection.handle || null,
              })
            : collection.handle
              ? `/products/${collection.handle}`
              : "/products";
          const isActive = isSearchPage
            ? selectedCollection === collection.handle
            : pathname === href;

          return (
            <li key={collection.name}>
              <Link
                href={href}
                onClick={() => {
                  if (!isSearchPage) {
                    return;
                  }

                  trackClient("search_facet_applied", {
                    facet_type: "collection",
                    facet_value: collection.handle || "all",
                    query: redactPiiFromQuery(query),
                  });
                }}
                className={clsx(
                  "block",
                  isActive && "font-medium underline underline-offset-4",
                )}
              >
                {collection.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
