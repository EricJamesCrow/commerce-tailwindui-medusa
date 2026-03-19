# Product Reviews Design

**Date:** 2026-02-21
**Approach:** Backend first (Medusa custom module), then storefront UI

## Decisions

| Decision | Choice |
|----------|--------|
| Verification | Verified purchase only |
| Moderation | Auto-publish with admin flagging |
| Storage | Medusa custom module ([official tutorial](https://docs.medusajs.com/resources/how-to-tutorials/tutorials/product-reviews)) |
| UI style | Amazon 5-star breakdown bars, TailwindPlus components |
| Placement | Full-width section below product details on PDP |
| Grid ratings | PDP only, not on product cards |
| Photos | Text only (title, rating, content) |
| Review form | Headless UI Dialog (modal) |

## Phase 1: Medusa Backend (Custom Module)

Following the [official Medusa product reviews tutorial](https://docs.medusajs.com/resources/how-to-tutorials/tutorials/product-reviews).

### Data Model

`Review` entity in a `productReview` custom module:

- `id` — unique identifier
- `title` — review title (optional)
- `content` — review body (required)
- `rating` — float 1-5 (check constraint)
- `first_name`, `last_name` — reviewer identity
- `status` — enum: `pending`, `approved`, `flagged` (defaults to `approved` for auto-publish)
- `product_id` — indexed reference to product
- `customer_id` — reference to authenticated customer

### Module Link

Read-only link connecting `Review.product_id` to the Product model for cross-module queries.

### Workflows

- **`createReviewWorkflow`** — validates product exists, verifies customer has a completed order containing the product, creates review. Compensation deletes review on failure.
- **`updateReviewWorkflow`** — updates review status (approve/flag/reject) with rollback.

### API Routes

**Store (customer-facing):**

- `POST /store/reviews` — creates review. Requires authentication + verified purchase. Request: `{ product_id, title?, content, rating }`. Auto-populates `first_name`, `last_name`, `customer_id` from auth context.
- `GET /store/products/[id]/reviews` — lists approved reviews. Supports `limit`, `offset`, `order`. Returns reviews + average rating + count + rating distribution.

**Admin (merchant-facing):**

- `GET /admin/reviews` — lists all reviews with pagination, filtering, product details.
- `POST /admin/reviews/status` — bulk update status (approve/flag/reject). Accepts `{ ids[], status }`.

### Admin Dashboard UI

- Reviews list page at `/reviews` with DataTable
- Status badges: green (approved), red (flagged/rejected), grey (pending)
- Bulk actions: approve and flag with keyboard shortcuts
- Toast notifications for success/error

## Phase 2: Storefront (Next.js)

### Data Layer

New file: `lib/medusa/reviews.ts`

**Functions:**

- `getProductReviews(productId, { limit, offset })` — fetches approved reviews from `GET /store/products/[id]/reviews`. Cached with `"use cache"` + `cacheTag(TAGS.reviews)` + `cacheLife("days")`. Returns `ProductReviews`.
- `addProductReview(productId, { title, content, rating })` — Server Action calling `POST /store/reviews` with auth headers. Revalidates `TAGS.reviews` on success.
- `canReviewProduct(productId)` — checks if current customer has a completed order with this product and hasn't already reviewed it.

**New cache tag:** `TAGS.reviews = "reviews"` in `lib/constants.ts`.

**Types** in `lib/types.ts`:

```typescript
type Review = {
  id: string;
  title: string;
  content: string;
  rating: number;
  firstName: string;
  lastName: string;
  createdAt: string;
};

type ProductReviews = {
  reviews: Review[];
  averageRating: number;
  count: number;
  ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
};
```

### UI Components

New directory: `components/reviews/`

Based on TailwindPlus components from `/Users/itsjusteric/CrowCommerce/Resources/TailwindUI/tailwindplus-components.json`.

#### `StarRating.tsx` (Server Component)

Reusable star display rendering filled/half/empty stars via SVG, matching TailwindPlus star patterns. Used by all review components.

#### `ReviewSummary.tsx` (Server Component)

Based on: `Ecommerce > Components > Reviews > With summary chart`

- Large average rating display with star visualization
- 5-star breakdown bars (horizontal percentage bars for each star level)
- Total review count
- "Write a review" button (visible only to authenticated customers with verified purchase)

#### `ReviewList.tsx` (Server Component + Client wrapper for pagination)

Based on: `Ecommerce > Components > Reviews > Simple with avatars`

- Paginated list of individual reviews
- Each review: star rating, title, content, reviewer first name + last initial, relative date
- "Load more" button for pagination (client component wrapper)

#### `ReviewForm.tsx` (Client Component)

Headless UI `Dialog` modal triggered by "Write a review" button in ReviewSummary.

- Interactive star rating selector (clickable 1-5 stars)
- Title input (optional)
- Content textarea (required)
- Submit via Server Action using `useActionState`
- Success message: "Your review has been posted"
- Error handling for auth/eligibility issues

#### `ProductReviews.tsx` (Server Component)

Composes `ReviewSummary` + `ReviewList` + `ReviewForm` into a full-width section. Fetches review data and passes it down.

### PDP Integration

In `app/product/[handle]/page.tsx`, add between `ProductWrapper` and `relatedProductsSlot`:

```tsx
<ProductWrapper ... />
<Suspense fallback={<ReviewsSkeleton />}>
  <ProductReviews productId={product.id} />
</Suspense>
{relatedProductsSlot}
```

### Structured Data

Add `aggregateRating` to the existing Product JSON-LD in `product-page-content.tsx` when reviews exist:

```json
{
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": 4.2,
    "reviewCount": 15
  }
}
```

## TailwindPlus Components Referenced

| Component | Path in catalog |
|-----------|----------------|
| Review summary with bars | `Ecommerce > Components > Reviews > With summary chart` |
| Individual review cards | `Ecommerce > Components > Reviews > Simple with avatars` |
| Star rating pattern | Used across all `Ecommerce > Components > Product Overviews` |
