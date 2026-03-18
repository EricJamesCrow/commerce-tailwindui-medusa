# Add Product Thumbnails to Email Templates

**Date:** 2026-03-18
**Status:** Approved
**Scope:** Single component change — `ItemTable` in `_commerce/item-table.tsx`

## Problem

Order-related email templates display line items with product name, variant, quantity, and price — but no product image. The data is already available: `formatItem()` in `backend/src/workflows/notifications/_format-helpers.ts` extracts `item.thumbnail` as `imageUrl` on every `CommerceLineItem`. The `ItemTable` component simply doesn't render it.

## Design

### What Changes

**One file:** `backend/src/modules/resend/templates/_commerce/item-table.tsx`

Add a 64x64px rounded thumbnail to the left of the product name/variant text in each item row. When `imageUrl` is absent, render the text without an image (no placeholder, no broken icon).

### Layout

**Before:**
```
| Item (50%)              | Qty (15%) | Price (20%) |
| Product Name            |     2     |      $90.00 |
| Variant                 |           |             |
```

**After:**
```
| Item (50%)                        | Qty (15%) | Price (20%) |
| [img] Product Name               |     2     |      $90.00 |
|       Variant                     |           |             |
```

The thumbnail is placed **inside** the existing 50% Item column using inline layout — not as a new column. The image sits left of the text within that column. Qty (15%) and Price (20%) columns are untouched. Add `Img` to the existing `@react-email/components` import.

### Image Rendering

- Use `<Img>` from `@react-email/components` for cross-client compatibility
- Set `width="64"` and `height="64"` as HTML attributes (not just CSS) — some email clients ignore CSS dimensions
- `border-radius: 8px` for rounded corners (degrades to square in older clients)
- `object-fit: cover` via inline style for consistent aspect ratio
- `alt` attribute set to the item name for accessibility
- Conditional rendering: only render the `<Img>` when `item.imageUrl` is truthy

### Templates Affected

All 5 templates that use `ItemTable` automatically benefit:

1. `order-confirmation.tsx`
2. `shipping-confirmation.tsx`
3. `order-canceled.tsx`
4. `abandoned-cart.tsx`
5. `admin-order-alert.tsx`

Note: `refund-confirmation.tsx` does not use `ItemTable` (it shows refund amount/date, not line items).

### Data Pipeline (already complete)

```
Medusa order/cart item
  → item.thumbnail (absolute URL from Medusa)
  → formatItem() in backend/src/workflows/notifications/_format-helpers.ts
  → imageUrl field on CommerceLineItem
  → ItemTable component (currently ignores it)
  → [THIS CHANGE] renders <Img> in item rows
```

No workflow, step, or type changes needed. The `CommerceLineItem` type already declares `imageUrl?: string`.

### Email Client Compatibility

- **Modern clients** (Gmail, Apple Mail, Outlook.com): Full support including border-radius
- **Outlook desktop (Word renderer)**: Images render but border-radius is ignored (square corners) — acceptable degradation
- **Image blocking**: When images are blocked by the email client, the `alt` text (product name) displays instead — no layout breakage since the image column is fixed-width

## Out of Scope

- Placeholder images when no thumbnail exists
- Image resizing or CDN optimization
- Changes to the data pipeline or format steps
- Changes to non-commerce email templates (welcome, password-reset, invite)
