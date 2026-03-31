---
status: in-progress
created: 2026-02-21
updated: 2026-03-30
---

# Product Reviews

> **Core reviews are shipped: backend module, storefront UI, admin moderation, admin responses, review images, and verified purchase badges. Remaining Phase 3 work is limited to admin review search and review editing after launch hardening.**

## What it does

Full product review system with 5-star ratings, verified purchase flow, admin moderation, admin response CRUD, customer image uploads, and Amazon-style summary bars on PDPs.

## Phases

### Phase 1: Core Backend + Storefront ✅

- [x] `productReview` custom module (model, service, workflows, API routes)
- [x] Storefront UI (form, list, summary, star ratings, Suspense streaming)
- [x] Admin moderation table with bulk actions
- [x] Denormalized `ReviewStats` table
- [x] Default review status "pending" (requires admin approval)
- [x] Soft deletes on review rollback
- [x] Event emission (`product_review.created`, `product_review.updated`)

### Phase 2: Admin Responses & Review Images ✅

- [x] `ProductReviewResponse` entity — admin replies to reviews (full CRUD)
- [x] `ProductReviewImage` entity — image upload endpoint
- [x] Display admin responses on storefront review list
- [x] Review image lightbox with prev/next navigation
- [x] Admin response management drawer
- [x] Image upload UI in review form dialog (max 3, JPEG/PNG/WebP)

### Phase 3: Verified Purchase & Admin Search/Edit ⏳

- [x] Order linking (`order_id`, `order_line_item_id`) for verified purchase badge
- [ ] Full-text search on review content + name in admin
- [ ] Review editing (upsert pattern — one review per customer per product)
- **Migration status:** `review` now stores nullable `order_id` and `order_line_item_id` columns to derive the verified purchase signal.
- **Verification:** Targeted review E2E coverage passes for moderated submission, admin response display, and verified purchase badge rendering.
- **Deferred:** Resume the remaining Phase 3 work after production launch validates the core review flow.

## Code review follow-ups

The code review follow-ups from PR #8 and PR #9 are complete. The remaining work for this feature is product-review-specific Phase 3 scope only, not cross-cutting cleanup.

## Key references

- Original plans: [archived](../archive/) — `2026-02-21-product-reviews-*.md` and `2026-02-22-review-phase2-*.md`
