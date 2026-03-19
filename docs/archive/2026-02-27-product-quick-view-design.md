# Product Quick View Design

## Overview

Add a Quick View modal to product cards in the storefront grid. Users hover over a product image to reveal a "Quick View" button; clicking it opens a TailwindPlus-based dialog showing product details, color/size selection, add-to-cart, and wishlist heart — without navigating away from the grid.

## Requirements

- Quick View button appears as an overlay on product images on hover
- Modal matches the TailwindPlus "Product Quick View" component exactly
- "Add to bag" text changed to "Add to cart"
- Wishlist heart button placed next to the "Add to cart" button
- Color swatches use real product variant data
- "View full details" link navigates to the product detail page
- Works with the existing product grid, cart actions, and wishlist system

## Components

### ProductQuickView (client component)

**File:** `storefront/components/product/product-quick-view.tsx`

The modal dialog. Based on the TailwindPlus Quick View component with these adaptations:

- **Headless UI Dialog** with backdrop transition (exact TailwindPlus markup and transition classes)
- **Left column (4/12 sm, 5/12 lg):** Product image via `next/image` (aspect-square, rounded-lg, object-cover)
- **Right column (8/12 sm, 7/12 lg):**
  - Product title (h2, text-2xl font-bold)
  - Price formatted via `Intl.NumberFormat` (matching existing price patterns)
  - Star rating (5-star display, matches PDP pattern)
  - Product description (text-sm text-gray-700)
  - Color swatches (radio fieldset, from product variant options, using `getColorHex()`)
  - Size picker (if product has size options)
  - "Add to cart" button (`bg-primary-600`, full-width) + WishlistButton heart beside it
  - "View full details" link (`text-primary-600`)
- **Close button:** XMarkIcon, top-right

**Variant selection:** Self-contained `useState` for selected color/size — does NOT use `ProductProvider` (which depends on URL search params and is PDP-specific). Derives the selected variant ID from local state + product variants array.

**Add to cart:** Uses `addItem` server action from `components/cart/actions.ts` via `useActionState`, same pattern as `related-products.tsx`. Passes the selected variant ID.

**Wishlist:** `WishlistButton` component placed next to the add-to-cart button, receiving the selected variant ID and pre-fetched wishlist state.

### ProductCardWithQuickView (client component)

**File:** `storefront/components/product/product-card-with-quick-view.tsx`

Wraps each product card in the grid. Manages modal open/close state.

**Props:**
```typescript
{
  product: Product;          // Internal Product type
  wishlistState?: {          // Pre-fetched from server
    isInWishlist: boolean;
    wishlistId: string;
    wishlistItemId: string;
  };
}
```

**Renders:**
- Product image with link (existing markup)
- Quick View button overlay: `opacity-0 group-hover:opacity-100` transition, centered on image
- WishlistButton (top-right, existing position)
- Product name + price links (existing markup)
- ProductQuickView dialog (rendered when open)

## Product Grid Changes

`storefront/components/layout/product-grid.tsx` remains a server component that fetches wishlist states in batch. Each product card delegates to `ProductCardWithQuickView` (client) instead of rendering inline.

## Data Flow

```
ProductGrid (server)
  → fetches products + batch wishlist states
  → passes Product + wishlistState to each card

ProductCardWithQuickView (client)
  → manages quickViewOpen state
  → renders card UI with hover overlay button
  → renders ProductQuickView dialog when open

ProductQuickView (client)
  → receives Product + wishlistState + onClose
  → local useState for color/size selection
  → derives variantId from selections
  → addItem server action for cart
  → WishlistButton for wishlist
```

## Styling

- All colors use `primary-*` theme tokens (not hardcoded indigo)
- Dialog transitions match TailwindPlus exactly (data-[closed], data-[enter], data-[leave])
- Responsive: full-screen on mobile, max-w-2xl on md, max-w-4xl on lg
- Quick View button overlay: white/80 bg, backdrop-blur, rounded-md, smooth opacity transition

## Not in Scope

- Size guide link
- Quantity selector (always adds 1, matching current cart behavior)
- Review count or review link in quick view
- Quick view on search results (uses same ProductGrid, will inherit automatically)
