"use client";

import { usePathname } from "next/navigation";
import { parseAsString, useQueryStates } from "nuqs";
import { useEffect, useMemo } from "react";
import {
  persistAttributionToDocument,
  readPersistedAttributionFromDocument,
} from "lib/utm/client";
import {
  getMissingAttributionValues,
  mergePersistedAttribution,
  type AttributionValues,
} from "lib/utm/shared";

const attributionQueryParsers = {
  utm_source: parseAsString,
  utm_medium: parseAsString,
  utm_campaign: parseAsString,
  utm_content: parseAsString,
  utm_term: parseAsString,
  gclid: parseAsString,
  fbclid: parseAsString,
};

function compactAttributionValues(
  values: Record<string, string | null>,
): AttributionValues {
  const compacted: AttributionValues = {};

  for (const [key, value] of Object.entries(values)) {
    if (value) {
      compacted[key as keyof AttributionValues] = value;
    }
  }

  return compacted;
}

export function AttributionPersistence() {
  const pathname = usePathname();
  const [queryState, setQueryState] = useQueryStates(attributionQueryParsers, {
    history: "replace",
    shallow: true,
    scroll: false,
  });

  const currentAttribution = useMemo(
    () => compactAttributionValues(queryState),
    [queryState],
  );

  useEffect(() => {
    const persisted = readPersistedAttributionFromDocument();
    const merged = mergePersistedAttribution(
      persisted,
      currentAttribution,
      pathname,
    );

    if (!merged) return;

    persistAttributionToDocument(merged);

    const missingValues = getMissingAttributionValues(
      currentAttribution,
      merged,
    );
    if (Object.keys(missingValues).length === 0) return;

    void setQueryState(missingValues);
  }, [currentAttribution, pathname, setQueryState]);

  return null;
}
