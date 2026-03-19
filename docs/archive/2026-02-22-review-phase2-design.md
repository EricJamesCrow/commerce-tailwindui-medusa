# Review Phase 2: Admin Responses + Review Images

**Date:** 2026-02-22
**Status:** Approved

## Overview

Extend the product reviews system with two features:
1. **Admin responses** — store owners can reply to individual reviews (one response per review)
2. **Review images** — customers can upload photos with their reviews (up to 3 per review)

## References

- [Lambda Curry medusa-plugins](https://github.com/lambda-curry/medusa-plugins) — `plugins/product-reviews/` for data model and workflow patterns
- [Medusa File Module docs](https://docs.medusajs.com/resources/infrastructure-modules/file) — `uploadFilesWorkflow` for image uploads
- [devx-commerce plugin](https://www.npmjs.com/package/@devx-commerce/plugin-product-reviews) — cross-reference for image attachment patterns

## Approach

Follow the Lambda Curry pattern: separate upload endpoint using Medusa's `uploadFilesWorkflow`, URL references stored in a `ProductReviewImage` model. Admin responses use a `ProductReviewResponse` model with `hasOne` relationship to `Review`.

## Data Models

### ProductReviewResponse (new)

Added to the existing `productReview` module.

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Primary key, prefix `prr` |
| `content` | text | Required. The admin's reply. |
| `review` | belongsTo(Review) | mappedBy: `response` |
| `created_at` | datetime | Auto |
| `updated_at` | datetime | Auto |
| `deleted_at` | datetime | Soft delete |

### ProductReviewImage (new)

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Primary key, prefix `prev_img` |
| `url` | text | Required. File Module URL. |
| `sort_order` | number | Default 0. Display order. |
| `review` | belongsTo(Review) | mappedBy: `images` |
| `created_at` | datetime | Auto |
| `updated_at` | datetime | Auto |
| `deleted_at` | datetime | Soft delete |

### Review model (modified)

Add two relationships to existing `Review` model:

```
response    — hasOne(ProductReviewResponse), nullable
images      — hasMany(ProductReviewImage)
```

Single migration covers all changes.

## API Routes

### Admin Response Routes

| Method | Route | Auth | Body | Returns |
|--------|-------|------|------|---------|
| `POST` | `/admin/reviews/:id/response` | Admin | `{ content: string }` | `{ product_review_response }` |
| `PUT` | `/admin/reviews/:id/response` | Admin | `{ content: string }` | `{ product_review_response }` |
| `DELETE` | `/admin/reviews/:id/response` | Admin | — | `{ message }` |

- POST fails if response already exists (use PUT to update)
- DELETE soft-deletes the response

### Store Upload Route

| Method | Route | Auth | Body | Returns |
|--------|-------|------|------|---------|
| `POST` | `/store/reviews/uploads` | Customer | `multipart/form-data` (files) | `{ files: [{ id, url }] }` |

Multer middleware with:
- **File filter:** JPEG, PNG, WebP only (reject SVG, PDF, etc.)
- **Size limit:** 5MB per file
- **Max files:** 3

### Modified Store Routes

- `POST /store/reviews` — accept optional `images: { url: string, sort_order: number }[]`
- `GET /store/products/:id/reviews` — include `images.*` and `response.*` in query fields

## Workflows

### New Workflows

1. **`createReviewResponseWorkflow`**
   - Steps: create response → emit `product_review_response.created`
   - Compensation: delete response on rollback

2. **`updateReviewResponseWorkflow`**
   - Steps: update response → emit `product_review_response.updated`
   - Compensation: restore previous content

3. **`deleteReviewResponseWorkflow`**
   - Steps: delete response → emit `product_review_response.deleted`
   - Compensation: recreate response

### Modified Workflows

4. **`createReviewWorkflow`**
   - Add image creation step after review creation
   - Validate image count (max 3)
   - Accept `images: { url, sort_order }[]` in input
   - Compensation: delete images on rollback

## Storefront Changes

### Review Form (`ReviewForm.tsx`)

- Add image upload area below textarea
- File input: `accept="image/jpeg, image/png, image/webp"`
- Client-side thumbnail previews via `URL.createObjectURL`
- On submit: upload images → get URLs → submit review with URLs
- Upload progress indicator
- Disabled submit during upload

### Review List (`ReviewList.tsx`)

- Below review content: row of small thumbnails (~64x64px)
- Click thumbnail → Headless UI `Dialog` lightbox with full-size image
- Prev/next navigation for multiple images

### Admin Response Display (new, in ReviewList)

- After each review with a `response`, show indented card
- Distinct styling: different background, "Store response" label
- Show response content and date

### Types (`lib/types.ts`)

```typescript
// Add to existing Review type
images: { id: string; url: string; sort_order: number }[];
response: { id: string; content: string; created_at: string } | null;
```

### Server Actions (`lib/medusa/reviews.ts`)

- `uploadReviewImages(files: File[])` — upload to `/store/reviews/uploads`
- Modify `addProductReview` to accept and pass image URLs
- Modify `getProductReviews` to include images and response data

## Admin UI

### Review Detail Drawer (extend existing)

- Add "Respond" button on review detail view
- Opens form to write/edit response
- Show existing response with edit/delete actions
- Response appears inline in review detail

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Upload fails | Show error in form. Don't submit review text. All-or-nothing. |
| Orphan images | If upload succeeds but review fails, files remain in storage. Acceptable — cleanup job can be added later. |
| Invalid file type/size | Rejected at multer layer before reaching backend |
| Image count > 3 | Rejected at workflow validation step |
| Response on non-existent review | 404 |
| Duplicate response (POST when one exists) | Error — use PUT to update |
| Response delete | Soft delete, consistent with Review model |
