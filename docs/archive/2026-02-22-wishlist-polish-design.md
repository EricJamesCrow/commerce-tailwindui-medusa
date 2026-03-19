# Wishlist Phase 2 Polish Design

**Goal:** Complete 4 remaining wishlist polish features — nav badge, heart button server state, rename/delete UI, and social proof count.

**Architecture:** All 4 features build on existing server actions and backend routes. Three are pure storefront UI; one requires a new backend store route.

---

## Feature 1: Nav Wishlist Badge

Heart icon with item count badge in the header, next to the cart icon.

- New server component `WishlistNav` wraps in `<Suspense fallback={null}>` (mirrors Cart pattern)
- Calls existing `getWishlistItemCount()` server action
- `HeartIcon` from `@heroicons/react/24/outline` with numeric count beside it
- Links to `/account/wishlist`
- Always shows heart icon; count badge hidden when 0

**Files:**
- Create: `storefront/components/wishlist/wishlist-nav.tsx`
- Modify: `storefront/components/layout/navbar/navbar-client.tsx` (add heart next to cart)

## Feature 2: Heart Button Server State

Hearts on product cards and PDP don't reflect current wishlist state. The `WishlistButton` already accepts `isInWishlist`, `wishlistId`, and `wishlistItemId` props — they just aren't passed.

- New helper `getVariantWishlistState(variantId)` in `wishlist.ts` returns `{ isInWishlist, wishlistId?, wishlistItemId? }`
- Product grid (`product-grid.tsx`): calls helper, passes result to `WishlistButton`
- Product detail page: same pattern

**Files:**
- Modify: `storefront/lib/medusa/wishlist.ts` (add `getVariantWishlistState()`)
- Modify: `storefront/components/layout/product-grid.tsx` (pass wishlist state)
- Modify: `storefront/app/product/[handle]/page.tsx` or PDP component (pass wishlist state)

## Feature 3: Rename/Delete Wishlist UI

Actions menu (ellipsis icon) in the wishlist page header with Rename and Delete options.

- **Rename**: Opens dialog pre-filled with current name. Calls existing `renameWishlist()` server action.
- **Delete**: Opens confirmation dialog. Calls existing `deleteWishlist()` server action. Switches to first remaining wishlist or shows empty state.
- Uses Headless UI `Menu` component for dropdown.

**Files:**
- Modify: `storefront/components/wishlist/wishlist-page-client.tsx` (add actions menu, rename dialog, delete confirmation)

## Feature 4: Social Proof Count

"X people saved this" on product detail pages.

- **Backend**: New `GET /store/products/:id/wishlist-count` route returning `{ count: number }`. Same query logic as existing admin route, publicly accessible.
- **Storefront**: New server action `getProductWishlistCount(productId)` and `WishlistCount` component on PDP. Hidden when count is 0.

**Files:**
- Create: `backend/src/api/store/products/[id]/wishlist-count/route.ts`
- Modify: `storefront/lib/medusa/wishlist.ts` (add `getProductWishlistCount()`)
- Create: `storefront/components/wishlist/wishlist-count.tsx`
- Modify: PDP to render `WishlistCount`

## Testing

- E2E tests for nav badge visibility and count
- E2E tests for heart button state on product grid and PDP
- E2E tests for rename/delete wishlist flows
- Manual verification of social proof count on PDP
