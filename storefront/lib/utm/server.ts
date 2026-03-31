import "server-only";
import { cookies } from "next/headers";
import {
  type AttributionValues,
  type PersistedAttribution,
  STOREFRONT_ATTRIBUTION_COOKIE,
  extractAttributionValues,
  mergePersistedAttribution,
  parsePersistedAttributionCookie,
} from "./shared";

type SearchParamsLike = Pick<URLSearchParams, "get">;

export async function getPersistedAttribution(): Promise<PersistedAttribution | null> {
  const cookieStore = await cookies();

  return parsePersistedAttributionCookie(
    cookieStore.get(STOREFRONT_ATTRIBUTION_COOKIE)?.value,
  );
}

export async function getRequestAttribution(options?: {
  pathname?: string;
  searchParams?: SearchParamsLike;
}): Promise<PersistedAttribution | null> {
  const persisted = await getPersistedAttribution();
  const pathname = options?.pathname || "/";

  if (!options?.searchParams) {
    return persisted;
  }

  const incoming = extractAttributionValues(options.searchParams);

  return mergePersistedAttribution(persisted, incoming, pathname);
}

export function getAttributionFromSearchParams(
  searchParams: SearchParamsLike,
): AttributionValues {
  return extractAttributionValues(searchParams);
}
