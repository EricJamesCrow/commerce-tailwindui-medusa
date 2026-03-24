# Meilisearch Integration — Design Spec

**Date:** 2026-03-21
**Status:** Approved
**Scope:** Backend indexing module + Storefront search UI upgrade

## Overview

Integrate Meilisearch into the CrowCommerce monorepo to replace the basic Medusa REST product search with full-text search, typo tolerance, and faceted filtering. The integration spans both the Medusa backend (indexing) and the Next.js 16 storefront (search UI). When Meilisearch is not configured, the storefront gracefully falls back to the current Medusa `getProducts()` query.

This is designed as a general-purpose, template-ready integration — not tied to any specific product catalog. Documentation covers how to customize indexed fields and facets for future clients.

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Storefront ↔ Meilisearch communication | Direct client-side | Fastest search (no Next.js server hop), enables `react-instantsearch` hooks natively |
| Fallback strategy | Runtime feature detection | Matches existing codebase pattern (PostHog, Stripe, etc.), no rebuild needed to toggle |
| Default facets | Collections, Price range, Availability | Universal to any e-commerce store; client-specific facets (tags, options) documented for extension |
| Filter UI | TailwindUI components + InstantSearch hooks | Consistent with existing design system; hooks provide data, TailwindUI provides markup |
| Backend module | Custom Medusa module with event subscribers | Standard Medusa v2 pattern, real-time sync, admin-triggered full reindex |

## Backend — Meilisearch Module

### Module Structure

```
backend/src/modules/meilisearch/
├── index.ts          # Module definition (resolve, service, options)
├── service.ts        # MeilisearchService — wraps the meilisearch JS client
└── types.ts          # MeilisearchOptions type
```

### Configuration

**`medusa-config.ts`** — conditional registration (same pattern as S3, Stripe, Resend, PostHog):

```ts
...(process.env.MEILISEARCH_HOST
  ? [{
      resolve: "./src/modules/meilisearch",
      options: {
        host: process.env.MEILISEARCH_HOST,
        apiKey: process.env.MEILISEARCH_API_KEY,
        productIndexName: process.env.MEILISEARCH_PRODUCT_INDEX_NAME || "products",
      },
    }]
  : []),
```

Console warning when `MEILISEARCH_HOST` is set but `MEILISEARCH_API_KEY` is missing.

### Environment Variables (Backend)

```env
MEILISEARCH_HOST=http://127.0.0.1:7700
MEILISEARCH_API_KEY=<master-key>
MEILISEARCH_PRODUCT_INDEX_NAME=products
```

### MeilisearchService

**Constructor:** Connects to Meilisearch, configures index settings on startup:

- **Searchable attributes:** `title`, `description`, `handle`, `tag_values`, `collection_titles`
- **Filterable attributes:** `collection_titles`, `availability`, `variant_prices`, `status`, `tag_values`
- **Sortable attributes:** `title`, `created_at`, `variant_prices`

**Methods:**

| Method | Purpose |
|---|---|
| `indexProduct(product)` | Upserts a single product document. Only indexes `published` products; deletes from index if status is not `published`. |
| `deleteProduct(productId)` | Removes a product from the index by ID. |
| `syncAll()` | Fetches all published products via Medusa's product module service, bulk-indexes them, deletes stale entries. |

### Indexed Product Document Schema

```ts
{
  id: string;                    // Medusa product ID
  title: string;
  description: string | null;
  handle: string;
  thumbnail: string | null;
  collection_titles: string[];   // Titles of associated collections
  tag_values: string[];          // Product tag values
  variant_prices: number[];      // All variant prices in major currency units (e.g., 24.99 not 2499) — Medusa v2 prices are already in major units, index as-is. NOTE: verify during implementation that Meilisearch's numeric range filtering on arrays works correctly with InstantSearch's useRange hook (a product with variants at $24.99 and $39.99 should match a $20–$30 filter). If not, fall back to indexing min_price/max_price as separate numeric fields.
  availability: boolean;         // true if any variant has inventory > 0
  status: string;                // "published" | "draft" | "archived"
  created_at: string;            // ISO timestamp
  updated_at: string;            // ISO timestamp
}
```

### Subscribers

**`backend/src/subscribers/meilisearch-product-upsert.ts`**
- Listens to: `product.created`, `product.updated`
- Resolves the meilisearch module service, fetches the full product, calls `indexProduct()`
- Guard: only runs when the meilisearch module is registered (check container resolution)

**`backend/src/subscribers/meilisearch-product-delete.ts`**
- Listens to: `product.deleted`
- Calls `deleteProduct(productId)`
- Guard: same container resolution check

**`backend/src/subscribers/meilisearch-sync.ts`**
- Listens to: custom `meilisearch.sync` event
- Calls `syncAll()` — processes products in batches of 1000 (configurable; Meilisearch supports up to 10K per batch, 1000 is a safe default that works for both small and large catalogs)

### Admin API Route

**`backend/src/api/admin/meilisearch/sync/route.ts`**
- `POST /admin/meilisearch/sync`
- Emits `meilisearch.sync` event via the event bus
- Returns `{ message: "Syncing data to Meilisearch" }`
- Auth: requires admin authentication (standard Medusa admin route)

## Storefront — Search UI

### New Dependencies

- `react-instantsearch` — InstantSearch hooks for React
- `@meilisearch/instant-meilisearch` — adapter connecting InstantSearch to Meilisearch
- `meilisearch` — JS client (used for lightweight Cmd+K queries)

### Feature Detection

**`storefront/lib/meilisearch.ts`:**

```ts
export const MEILISEARCH_ENABLED =
  !!process.env.NEXT_PUBLIC_MEILISEARCH_HOST &&
  !!process.env.NEXT_PUBLIC_MEILISEARCH_API_KEY;
```

When enabled, exports the `searchClient` (from `@meilisearch/instant-meilisearch`) and the index name. Components check `MEILISEARCH_ENABLED` to decide which code path to render.

### Environment Variables (Storefront)

```env
NEXT_PUBLIC_MEILISEARCH_HOST=http://127.0.0.1:7700
NEXT_PUBLIC_MEILISEARCH_API_KEY=<search-only-key>
NEXT_PUBLIC_MEILISEARCH_INDEX_NAME=products
```

**Security:** The storefront uses a search-only API key, never the master key.

### Cmd+K Palette Changes

**Modified file:** `storefront/components/search-command/use-search.tsx`

- If `MEILISEARCH_ENABLED`, uses the `meilisearch` JS client directly (lightweight — no InstantSearch widgets needed for the palette) with the same 300ms debounce.
- If not enabled, falls back to the existing `searchProducts` server action.
- The result shape stays the same (`Product[]` + `totalCount`) — Meilisearch hits are transformed into the existing `Product` type inside the hook.
- `ProductResult`, `SearchDialog`, and `SearchButton` components are **unchanged**.

### Search Results Page

**Modified file:** `storefront/app/(store)/search/page.tsx`
- Reads `searchParams`, checks `MEILISEARCH_ENABLED`
- If enabled: renders `<MeilisearchResults initialQuery={q} initialCollection={collection} />`
- Supports collection pre-filtering via URL param (e.g., `/search?q=powder&collection=capsules`) — pre-selects the collection facet in the filter sidebar
- If not: renders current server-component grid (unchanged behavior)

**Unchanged file:** `storefront/app/(store)/search/[collection]/page.tsx`
- This is a legacy redirect (`redirect(/products/${collection})`) — no Meilisearch changes needed. Collection-scoped search is handled by the faceted search page via URL params instead.

**New file:** `storefront/app/(store)/search/meilisearch-results.tsx` (`'use client'`)

Wraps the page in `<InstantSearch>` with the Meilisearch adapter. Uses TailwindUI component patterns (Headless UI `Disclosure`, `Dialog`, `Menu`) for all filter UI, wired to InstantSearch hooks for data:

| UI Element | InstantSearch Hook | TailwindUI Pattern |
|---|---|---|
| Collections filter | `useRefinementList({ attribute: 'collection_titles' })` | `Disclosure` with checkboxes + hit counts |
| Price range slider | `useRange({ attribute: 'variant_prices' })` | `Disclosure` with dual-thumb range slider |
| Availability filter | `useRefinementList({ attribute: 'availability' })` | `Disclosure` with checkboxes |
| Sort dropdown | `useSortBy()` | Headless UI `Menu` |
| Product grid | `useHits()` | Existing `ProductGrid` card style |
| Pagination | `usePagination()` | Numbered page links |
| Search input | `useSearchBox()` | Pre-populated from URL `?q=` param |

**Layout:**

- **Desktop:** `lg:grid lg:grid-cols-4` — filter sidebar in column 1 (sticky), product grid spanning columns 2–4. Sort dropdown + result count in header bar.
- **Mobile:** `FunnelIcon` button triggers a `Dialog` slide-out drawer from the right containing the same filter `Disclosure` sections.
- All filter sections are collapsible via Headless UI `Disclosure` with `PlusIcon`/`MinusIcon` toggle.

**URL state:** InstantSearch routing syncs facet selections to URL params so filtered views are shareable/bookmarkable.

### File Change Summary

| File | Action |
|---|---|
| `storefront/lib/meilisearch.ts` | **New** — searchClient, feature flag, index name |
| `storefront/components/search-command/use-search.tsx` | **Modified** — conditional Meilisearch path |
| `storefront/app/(store)/search/page.tsx` | **Modified** — conditional render of MeilisearchResults |
| `storefront/app/(store)/search/meilisearch-results.tsx` | **New** — InstantSearch wrapper + TailwindUI filter UI |

## Fallback Behavior

When `NEXT_PUBLIC_MEILISEARCH_HOST` is not set:
- **Cmd+K palette:** Uses existing `searchProducts` server action → `getProducts()` → Medusa REST API. No change to current behavior.
- **Search results page:** Uses existing server component rendering. No facets, just query + sort. No change to current behavior.
- **No broken imports:** `react-instantsearch` and `@meilisearch/instant-meilisearch` are only imported in the Meilisearch code paths (dynamic imports or conditional rendering ensures no runtime errors).

## Analytics Events

| Event | Properties | Location |
|---|---|---|
| `search_performed` | `query`, `result_count`, `source: "meilisearch" \| "medusa"` | Storefront — `use-search.tsx` (update existing event to include `source`); also update existing call site in `actions.ts` to emit `source: "medusa"` |
| `search_facet_applied` | `facet_type`, `facet_value`, `query` | Storefront — `meilisearch-results.tsx` (client-side) |
| `search_result_clicked` | `query`, `product_id`, `position`, `source` | Storefront — Cmd+K palette and search results page |
| `meilisearch_sync_triggered` | `trigger: "admin" \| "subscriber"` | Backend — sync route and subscribers |
| `meilisearch_sync_completed` | `product_count`, `duration_ms` | Backend — after `syncAll()` completes |

All events added to the `AnalyticsEvents` type map with typed properties before use.

## Documentation

**New file:** `docs/features/search.md`

Sections:
1. **Overview** — what Meilisearch provides vs the default Medusa REST fallback
2. **Setup** — Meilisearch server requirements, env vars (backend + storefront), triggering initial sync
3. **How it works** — backend indexing flow, storefront search flow, fallback behavior
4. **Customizing for your store** — adding filterable attributes, adding facet UI sections, changing searchable fields, customizing sort options, adjusting indexed fields
5. **Troubleshooting** — common issues (stale index, missing env vars, search key permissions)

## Out of Scope

- Meilisearch server deployment/hosting (documented as a prerequisite)
- Client-specific facets (tags, product options) — documented as extension points
- Search analytics dashboard in the admin UI
- Multi-index search (e.g., searching collections, blog posts)
- Autocomplete/suggestions beyond the existing Cmd+K result list
