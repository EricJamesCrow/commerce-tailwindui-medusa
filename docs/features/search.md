# Search

The storefront supports two search backends: **Meilisearch** (full-text search with faceted filtering) and **Medusa REST** (basic text search). Meilisearch is optional — when not configured, the storefront falls back to Medusa's built-in product search.

## Setup

### Prerequisites

- A running Meilisearch instance ([installation guide](https://www.meilisearch.com/docs/learn/getting_started/installation))
- A search-only API key (never expose the master key to the browser)

### Backend Environment Variables

```env
MEILISEARCH_HOST=http://127.0.0.1:7700
MEILISEARCH_API_KEY=<master-key>
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
- **Search results page:** Uses `react-instantsearch` with faceted filters (collections, price range, availability)
- **Fallback:** When `NEXT_PUBLIC_MEILISEARCH_HOST` is not set, both paths use Medusa's REST API

### Indexed Fields

Each product document in Meilisearch contains:

| Field | Type | Purpose |
|---|---|---|
| `id` | string | Medusa product ID |
| `title` | string | Searchable |
| `description` | string | Searchable |
| `handle` | string | Searchable, used for product URLs |
| `thumbnail` | string | Product image |
| `collection_titles` | string[] | Filterable, searchable |
| `tag_values` | string[] | Filterable, searchable |
| `variant_prices` | number[] | Filterable (range), sortable |
| `availability` | boolean | Filterable (in-stock toggle) |
| `created_at` | string | Sortable |

## Customizing for Your Store

### Adding Filterable Attributes

1. **Backend:** Update the `useQueryGraphStep` fields in `backend/src/workflows/sync-products.ts` to include the new field
2. **Backend:** Add the field to the `transform` block that builds the indexed document
3. **Backend:** Add the field to `filterableAttributes` in `backend/src/modules/meilisearch/service.ts` → `configureIndex()`
4. **Backend:** Trigger a full reindex: `POST /admin/meilisearch/sync`

### Adding a Facet UI Section

In `storefront/app/(store)/search/meilisearch-results.tsx`, add a new `<Disclosure>` section inside `FilterSections()`:

```tsx
<Disclosure as="div" className="border-b border-gray-200 py-6" defaultOpen>
  <h3 className="-my-3 flow-root">
    <DisclosureButton className="group flex w-full items-center justify-between bg-white py-3 text-sm text-gray-400 hover:text-gray-500">
      <span className="font-medium text-gray-900">Your Facet Name</span>
      {/* ... expand/collapse icons ... */}
    </DisclosureButton>
  </h3>
  <DisclosurePanel className="pt-6">
    <RefinementList attribute="your_attribute_name" />
  </DisclosurePanel>
</Disclosure>
```

### Changing Searchable Fields

Update `searchableAttributes` in `backend/src/modules/meilisearch/service.ts` → `configureIndex()`. The order matters — earlier fields are weighted higher in relevance.

### Adjusting Sort Options

Update the `sortItems` array in `storefront/app/(store)/search/meilisearch-results.tsx`. Sort indices use the format `indexName:attribute:direction`.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Search returns no results | Index is empty | Run `POST /admin/meilisearch/sync` |
| Facet counts show 0 | Attribute not in `filterableAttributes` | Add to `configureIndex()` and reindex |
| "Invalid API key" error | Wrong key type | Use master key for backend, search-only key for storefront |
| Products not updating | Subscriber not firing | Check backend logs for `[Meilisearch]` messages; verify module is loaded |
| Storefront shows Medusa results | Missing env vars | Verify `NEXT_PUBLIC_MEILISEARCH_HOST` and `NEXT_PUBLIC_MEILISEARCH_API_KEY` are set |
