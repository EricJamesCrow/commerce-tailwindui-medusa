# Email Product Thumbnails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 64px product thumbnail images to all order-related email templates.

**Architecture:** Single-component change to `ItemTable` — add an `<Img>` element inside the existing Item column when `imageUrl` is present. The data pipeline already provides `imageUrl` on every `CommerceLineItem`; this plan only touches rendering.

**Tech Stack:** React Email (`@react-email/components`), TypeScript

**Spec:** `docs/superpowers/specs/2026-03-18-email-product-thumbnails-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/src/modules/resend/templates/_commerce/item-table.tsx` | Modify | Add `<Img>` rendering for `imageUrl` |
| `backend/src/modules/resend/templates/order-confirmation.tsx` | Modify | Add `imageUrl` to PreviewProps |
| `backend/src/modules/resend/templates/shipping-confirmation.tsx` | Modify | Add `imageUrl` to PreviewProps |
| `backend/src/modules/resend/templates/order-canceled.tsx` | Modify | Add `imageUrl` to PreviewProps |
| `backend/src/modules/resend/templates/abandoned-cart.tsx` | Modify | Add `imageUrl` to PreviewProps |
| `backend/src/modules/resend/templates/admin-order-alert.tsx` | Modify | Add `imageUrl` to PreviewProps |

---

### Task 1: Update ItemTable to render product thumbnails

**Files:**
- Modify: `backend/src/modules/resend/templates/_commerce/item-table.tsx`

- [ ] **Step 1: Add `Img` to the import**

Add `Img` to the existing `@react-email/components` import:

```tsx
import { Column, Img, Row, Section } from "@react-email/components";
```

- [ ] **Step 2: Update the item row to render the thumbnail**

Replace the Item column in each row (lines 39-48) with a layout that places the image left of the text. When `imageUrl` is absent, render text only (no image, no placeholder).

```tsx
<Column className="w-[50%]">
  <table cellPadding="0" cellSpacing="0" border={0}>
    <tbody>
      <tr>
        {item.imageUrl && (
          <td style={{ verticalAlign: "top", paddingRight: 12, width: 64 }}>
            <Img
              src={item.imageUrl}
              alt={item.name}
              width="64"
              height="64"
              style={{
                borderRadius: 8,
                objectFit: "cover",
                display: "block",
              }}
            />
          </td>
        )}
        <td style={{ verticalAlign: "top" }}>
          <Text className="m-0 text-sm text-primary">
            {item.name}
          </Text>
          {item.variant && (
            <Text className="m-0 text-xs text-tertiary">
              {item.variant}
            </Text>
          )}
        </td>
      </tr>
    </tbody>
  </table>
</Column>
```

**Why a nested `<table>` instead of flexbox/grid:** Email clients (especially Outlook's Word renderer) have unreliable CSS layout support. A nested table with `verticalAlign: "top"` is the most reliable way to place an image beside text in email HTML.

- [ ] **Step 3: Verify the backend builds**

Run: `cd backend && bun run build`
Expected: Build succeeds with no type errors.

- [ ] **Step 4: Commit**

Stage and commit (do NOT use `git push` or `gh pr create` — use `gt` per CLAUDE.md):

```bash
git add backend/src/modules/resend/templates/_commerce/item-table.tsx
git commit -m "feat(email): add product thumbnail images to ItemTable component"
```

---

### Task 2: Add imageUrl to template PreviewProps

Update preview data in all 5 templates that use `ItemTable` so thumbnails are visible in the React Email dev preview (`bun run dev:emails`).

**Files:**
- Modify: `backend/src/modules/resend/templates/order-confirmation.tsx`
- Modify: `backend/src/modules/resend/templates/shipping-confirmation.tsx`
- Modify: `backend/src/modules/resend/templates/order-canceled.tsx`
- Modify: `backend/src/modules/resend/templates/abandoned-cart.tsx`
- Modify: `backend/src/modules/resend/templates/admin-order-alert.tsx`

- [ ] **Step 1: Add `imageUrl` to each template's PreviewProps items array**

In each of the 5 files, find the `PreviewProps` object and add `imageUrl` to every item in the `items` array. Use a public placeholder image:

```tsx
imageUrl: "https://placehold.co/128x128?text=Product"
```

For example, in `order-confirmation.tsx` the items become:
```tsx
items: [
  { name: "Leather Crossbody Bag", variant: "Tan / One Size", quantity: 1, price: "$128.00", imageUrl: "https://placehold.co/128x128?text=Product" },
  { name: "Merino Wool Scarf", variant: "Charcoal", quantity: 2, price: "$98.00", imageUrl: "https://placehold.co/128x128?text=Product" },
],
```

Apply the same pattern to all 5 templates. Also include one item **without** `imageUrl` in `order-confirmation.tsx` to verify the no-image fallback works:

```tsx
{ name: "Gift Wrapping", quantity: 1, price: "$5.00" },
```

- [ ] **Step 2: Verify the backend builds**

Run: `cd backend && bun run build`
Expected: Build succeeds with no type errors.

- [ ] **Step 3: Commit**

Stage and commit:

```bash
git add backend/src/modules/resend/templates/order-confirmation.tsx backend/src/modules/resend/templates/shipping-confirmation.tsx backend/src/modules/resend/templates/order-canceled.tsx backend/src/modules/resend/templates/abandoned-cart.tsx backend/src/modules/resend/templates/admin-order-alert.tsx
git commit -m "feat(email): add product thumbnail imageUrl to template preview props"
```

---

### Task 3: Visual verification with email preview

- [ ] **Step 1: Start the email preview server**

Run: `cd backend && bun run dev:emails` (or however the React Email preview is configured — check `package.json` scripts)

- [ ] **Step 2: Open the order confirmation template in browser**

Check:
- Thumbnails render at 64px with rounded corners
- Product name and variant are vertically aligned to the top of the image
- The "Gift Wrapping" item (no imageUrl) renders text-only with no broken image
- Qty and Price columns are unaffected

- [ ] **Step 3: Spot-check the other 4 templates**

Open each in the preview and verify thumbnails appear correctly.

- [ ] **Step 4: Update TODO.md**

Mark the email thumbnails item as complete:
```
- [x] Add product thumbnail images to email templates (item table rows currently show name/variant/qty/price but no images — data is available via `item.thumbnail` from `formatOrderForEmailStep`)
```

- [ ] **Step 5: Commit**

```bash
git add TODO.md
git commit -m "docs: mark email product thumbnails as complete in TODO"
```
