# Search

The storefront supports two search backends: **Meilisearch** and **Medusa REST**. Meilisearch is optional. When it is configured, the shipped search experience includes backend indexing, the Cmd+K Meilisearch path, and `/search` query-param filtering/sorting. When it is not configured, the storefront falls back to Medusa's built-in product search.

The dedicated faceted sidebar UI described in earlier plans is not shipped on `main`. The current `/search` page uses the shared listing layout plus a Meilisearch helper, not a standalone `react-instantsearch` page shell.

## Setup

### Prerequisites

- A running Meilisearch instance ([installation guide](https://www.meilisearch.com/docs/learn/getting_started/installation))
- A search-only API key (never expose the master key to the browser)

### Backend Environment Variables

```env
MEILISEARCH_HOST=http://127.0.0.1:7700
MEILISEARCH_API_KEY=<master-key>
MEILISEARCH_REGION_ID=<region-id>             # required for calculated-price indexing
MEILISEARCH_PRODUCT_INDEX_NAME=products    # optional, defaults to "products"
```

### Storefront Environment Variables

```env
NEXT_PUBLIC_MEILISEARCH_HOST=http://127.0.0.1:7700
NEXT_PUBLIC_MEILISEARCH_API_KEY=<search-only-key>
NEXT_PUBLIC_MEILISEARCH_INDEX_NAME=products    # optional, defaults to "products"
```

### Initial Sync

After configuring env vars and starting the backend, trigger a full product sync:

```bash
curl -X POST http://localhost:9000/admin/meilisearch/sync \
  -H "Authorization: Bearer <admin-token>"
```

This indexes all published products. Subsequent changes sync automatically via event subscribers.

## How It Works

### Backend Indexing

- **Module:** `backend/src/modules/meilisearch/` — wraps the Meilisearch JS client
- **Workflows:** `sync-products` (index/update) and `delete-products-from-meilisearch` (remove)
- **Subscribers:** Listen to `product.created`, `product.updated`, `product.deleted` events
- **Admin route:** `POST /admin/meilisearch/sync` triggers a full reindex

### Storefront Search

- **Cmd+K palette:** Queries Meilisearch directly via the JS client (8 results, debounced 300ms)
- **Search results page:** Uses `searchIndexedProducts()` to read query params like `collection`, `availability`, `minPrice`, `maxPrice`, and `sort`, then hydrates product cards from Medusa by handle
- **Fallback:** When `NEXT_PUBLIC_MEILISEARCH_HOST` is not set, both paths use Medusa's REST API

### Indexed Fields

Each product document in Meilisearch contains:

| Field               | Type     | Purpose                           |
| ------------------- | -------- | --------------------------------- |
| `id`                | string   | Medusa product ID                 |
| `title`             | string   | Searchable                        |
| `description`       | string   | Searchable                        |
| `handle`            | string   | Searchable, used for product URLs |
| `thumbnail`         | string   | Product image                     |
| `collection_titles` | string[] | Filterable, searchable            |
| `tag_values`        | string[] | Filterable, searchable            |
| `variant_prices`    | number[] | Used for range matching           |
| `min_variant_price` | number   | Sortable + range prefilter        |
| `max_variant_price` | number   | Sortable + range prefilter        |
| `availability`      | boolean  | Filterable (in-stock toggle)      |
| `created_at`        | string   | Sortable                          |

## Customizing for Your Store

### Adding Filterable Attributes

1. **Backend:** Update the `useQueryGraphStep` fields in `backend/src/workflows/sync-products.ts` to include the new field
2. **Backend:** Add the field to the `transform` block that builds the indexed document
3. **Backend:** Add the field to `filterableAttributes` in `backend/src/modules/meilisearch/service.ts` → `configureIndex()`
4. **Backend:** Trigger a full reindex: `POST /admin/meilisearch/sync`

### Adding a Facet UI Section

The current UI does not have a separate `meilisearch-results.tsx` shell. If you add a visible facet picker, wire it into the shared listing components instead:

1. Add the control to the existing search/listing UI in `storefront/components/layout/search/collections.tsx`, `sort-filter-menu.tsx`, or `mobile-filters.tsx`.
2. Serialize the chosen facet into the existing `/search` query params (`collection`, `availability`, `minPrice`, `maxPrice`, `sort`).
3. Let `storefront/lib/meilisearch.ts` translate those query params into Meilisearch filters and sorting.

### Changing Searchable Fields

Update `searchableAttributes` in `backend/src/modules/meilisearch/service.ts` → `configureIndex()`. The order matters — earlier fields are weighted higher in relevance.

### Adjusting Sort Options

Update the listing sort config that feeds `/search`, then make sure `getSortExpression()` in `storefront/lib/meilisearch.ts` maps those slugs onto the appropriate Meilisearch sort expressions.

## Troubleshooting

| Symptom                         | Cause                                   | Fix                                                                                 |
| ------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------- |
| Search returns no results       | Index is empty                          | Run `POST /admin/meilisearch/sync`                                                  |
| Facet counts show 0             | Attribute not in `filterableAttributes` | Add to `configureIndex()` and reindex                                               |
| "Invalid API key" error         | Wrong key type                          | Use master key for backend, search-only key for storefront                          |
| Products not updating           | Subscriber not firing                   | Check backend logs for `[Meilisearch]` messages; verify module is loaded            |
| Storefront shows Medusa results | Missing env vars                        | Verify `NEXT_PUBLIC_MEILISEARCH_HOST` and `NEXT_PUBLIC_MEILISEARCH_API_KEY` are set |
