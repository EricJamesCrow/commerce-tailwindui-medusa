---
status: in-progress
created: 2026-02-21
updated: 2026-03-28
---

# Product Reviews

> **Phases 1-2 shipped (backend module, storefront UI, admin moderation, admin responses, review images). Phase 3 in progress: verified purchase shipped, admin review search/editing deferred until after launch.**

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

### Phase 3: Verified Purchase & Search ⏳
- [x] Order linking (`order_id`, `order_line_item_id`) for verified purchase badge
- [ ] Full-text search on review content + name in admin
- [ ] Review editing (upsert pattern — one review per customer per product)
- **Migration status:** `review` now stores nullable `order_id` and `order_line_item_id` columns to derive the verified purchase signal.
- **Verification:** Targeted review E2E coverage passes for moderated submission, admin response display, and verified purchase badge rendering.
- **Deferred:** Resume the remaining Phase 3 work after production launch validates the core review flow.

## Code review follow-ups

Independent cleanup tasks from code review, not gated on Phase 3.

### From PR #8
- [ ] Migrate admin review drawer to `@medusajs/ui` primitives (Drawer, Button, Textarea, Label) for consistency with admin UI conventions
- [ ] Validate `images[].url` hostname against storage provider domain, or switch to opaque upload IDs instead of raw URLs (security hardening)
- [ ] Refactor `uploadReviewImages` server action to accept `FormData` instead of `File[]` for proper Server Action serialization
- [ ] Add `data-testid` attributes to review components and migrate E2E selectors from Tailwind classes to stable `data-testid` selectors
- [ ] Extract ReviewList lightbox state into a thin client wrapper so the list itself can be a server component
- [ ] Add regex validation for Medusa IDs in E2E fixture SQL interpolation (e.g. `/^rev_[a-z0-9]+$/`)
- [ ] Add fail-fast env var checks in E2E fixtures for CI environments
- [ ] Rename `prev_img` ID prefix to `revi` on ReviewImage model (requires migration)
- [ ] Revoke `URL.createObjectURL` blobs in ReviewForm on file remove and component cleanup
- [ ] Add explicit `multer` to backend `package.json` dependencies (currently works via transitive dep from `@medusajs/medusa`)

### From PR #9
- [ ] Strip `payment_sessions` from checkout cart serialization — only pass `client_secret` to client via dedicated server action (Finding #1: broad payment-session exposure)
- [ ] Add Zod schema validation to checkout server actions for `email`, address payloads, `providerId`, and `data` params (Finding #2: no input validation at action boundaries)

## Key references

- Original plans: [archived](../archive/) — `2026-02-21-product-reviews-*.md` and `2026-02-22-review-phase2-*.md`
