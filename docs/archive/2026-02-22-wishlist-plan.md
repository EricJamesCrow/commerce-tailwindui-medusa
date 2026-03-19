# Wishlist Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Full wishlist system with guest support, multiple named wishlists, JWT sharing, variant-level tracking, and TailwindUI-based storefront UI.

**Architecture:** Built-in Medusa v2 module at `backend/src/modules/wishlist/` with full workflows and compensation. Storefront server actions follow existing `customer.ts` and `reviews.ts` patterns. Guest wishlists use cookie-stored IDs with transfer on login. UI uses TailwindUI components from the catalog JSON.

**Tech Stack:** Medusa v2 (DML, workflows, query graph, module links), Next.js 16 (RSC, server actions, `"use cache"`), TailwindUI/Headless UI, Heroicons.

**Design doc:** `docs/plans/2026-02-22-wishlist-design.md`

---

## Prerequisites

- Backend running on port 9000 (`cd backend && bun run dev`)
- Storefront running on port 3000 (`cd storefront && bun dev`)
- PostgreSQL running (`brew services start postgresql@17`)
- At least one product with variants in Medusa admin
- At least one customer account for testing

---

## Task 1: Wishlist Module — Data Models

**Files:**
- Create: `backend/src/modules/wishlist/models/wishlist.ts`
- Create: `backend/src/modules/wishlist/models/wishlist-item.ts`
- Create: `backend/src/modules/wishlist/service.ts`
- Create: `backend/src/modules/wishlist/index.ts`

**Step 1: Create the Wishlist model**

Create `backend/src/modules/wishlist/models/wishlist.ts`:

```typescript
import { model } from "@medusajs/framework/utils"
import { WishlistItem } from "./wishlist-item"

export const Wishlist = model
  .define("wishlist", {
    id: model.id({ prefix: "wl" }).primaryKey(),
    name: model.text().nullable(),
    customer_id: model.text().nullable(),
    sales_channel_id: model.text(),
    items: model.hasMany(() => WishlistItem, {
      mappedBy: "wishlist",
    }),
  })
  .indexes([
    {
      on: ["customer_id", "sales_channel_id"],
      where: { customer_id: { $ne: null } },
    },
  ])
```

Note: Non-unique index. Multiple wishlists per customer allowed. Guest single-wishlist enforced in workflow logic.

**Step 2: Create the WishlistItem model**

Create `backend/src/modules/wishlist/models/wishlist-item.ts`:

```typescript
import { model } from "@medusajs/framework/utils"
import { Wishlist } from "./wishlist"

export const WishlistItem = model
  .define("wishlist_item", {
    id: model.id({ prefix: "wli" }).primaryKey(),
    product_variant_id: model.text(),
    wishlist: model.belongsTo(() => Wishlist, {
      mappedBy: "items",
    }),
  })
  .indexes([
    {
      on: ["product_variant_id", "wishlist_id"],
      unique: true,
    },
  ])
```

**Step 3: Create the service**

Create `backend/src/modules/wishlist/service.ts`:

```typescript
import { MedusaService } from "@medusajs/framework/utils"
import { Wishlist } from "./models/wishlist"
import { WishlistItem } from "./models/wishlist-item"

class WishlistModuleService extends MedusaService({
  Wishlist,
  WishlistItem,
}) {}

export default WishlistModuleService
```

Note: Keep it simple. The `getWishlistsOfVariants` custom method for admin widget count is deferred to Task 12. The auto-generated CRUD from `MedusaService` is sufficient for now.

**Step 4: Create the module export**

Create `backend/src/modules/wishlist/index.ts`:

```typescript
import { Module } from "@medusajs/framework/utils"
import WishlistModuleService from "./service"

export const WISHLIST_MODULE = "wishlist"

export default Module(WISHLIST_MODULE, {
  service: WishlistModuleService,
})
```

**Step 5: Generate and run the migration**

```bash
cd backend && bunx medusa db:generate wishlist
cd backend && bunx medusa db:migrate
```

Verify: Check that `wishlist` and `wishlist_item` tables exist in PostgreSQL.

**Step 6: Commit**

```bash
git add backend/src/modules/wishlist/
git commit -m "feat: add wishlist module with data models

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Module Links

**Files:**
- Create: `backend/src/links/wishlist-customer.ts`
- Create: `backend/src/links/wishlist-sales-channel.ts`
- Create: `backend/src/links/wishlist-item-product-variant.ts`

**Step 1: Create customer link**

Create `backend/src/links/wishlist-customer.ts`:

```typescript
import { defineLink } from "@medusajs/framework/utils"
import WishlistModule from "../modules/wishlist"
import CustomerModule from "@medusajs/medusa/customer"

export default defineLink(
  {
    linkable: WishlistModule.linkable.wishlist,
    field: "customer_id",
    isList: false,
  },
  CustomerModule.linkable.customer,
  {
    readOnly: true,
  }
)
```

**Step 2: Create sales channel link**

Create `backend/src/links/wishlist-sales-channel.ts`:

```typescript
import { defineLink } from "@medusajs/framework/utils"
import WishlistModule from "../modules/wishlist"
import SalesChannelModule from "@medusajs/medusa/sales-channel"

export default defineLink(
  {
    linkable: WishlistModule.linkable.wishlist,
    field: "sales_channel_id",
    isList: false,
  },
  SalesChannelModule.linkable.salesChannel,
  {
    readOnly: true,
  }
)
```

**Step 3: Create product variant link**

Create `backend/src/links/wishlist-item-product-variant.ts`:

```typescript
import { defineLink } from "@medusajs/framework/utils"
import WishlistModule from "../modules/wishlist"
import ProductModule from "@medusajs/medusa/product"

export default defineLink(
  {
    linkable: WishlistModule.linkable.wishlistItem,
    field: "product_variant_id",
    isList: false,
  },
  ProductModule.linkable.productVariant,
  {
    readOnly: true,
  }
)
```

**Step 4: Run migration for links**

```bash
cd backend && bunx medusa db:migrate
```

**Step 5: Verify links work**

Restart the backend and check the logs for any link registration errors.

```bash
cd backend && bun run dev
```

**Step 6: Commit**

```bash
git add backend/src/links/wishlist-customer.ts backend/src/links/wishlist-sales-channel.ts backend/src/links/wishlist-item-product-variant.ts
git commit -m "feat: add wishlist module links to customer, sales channel, product variant

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Workflow Steps

**Files:**
- Create: `backend/src/workflows/steps/create-wishlist.ts`
- Create: `backend/src/workflows/steps/create-wishlist-item.ts`
- Create: `backend/src/workflows/steps/delete-wishlist-item.ts`
- Create: `backend/src/workflows/steps/delete-wishlist.ts`
- Create: `backend/src/workflows/steps/update-wishlist.ts`
- Create: `backend/src/workflows/steps/transfer-wishlist.ts`
- Create: `backend/src/workflows/steps/validate-wishlist-exists.ts`
- Create: `backend/src/workflows/steps/validate-wishlist-sales-channel.ts`
- Create: `backend/src/workflows/steps/validate-variant-wishlist.ts`
- Create: `backend/src/workflows/steps/validate-item-in-wishlist.ts`

**Step 1: Create validation steps**

Create `backend/src/workflows/steps/validate-wishlist-exists.ts`:

```typescript
import { MedusaError } from "@medusajs/framework/utils"
import { createStep } from "@medusajs/framework/workflows-sdk"

type Input = {
  wishlists?: { id: string }[]
}

// NOTE: Do NOT use throwIfKeyNotFound on customer_id filters (Medusa GitHub #11550)
export const validateWishlistExistsStep = createStep(
  "validate-wishlist-exists",
  async (input: Input) => {
    if (!input.wishlists?.length) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "No wishlist found"
      )
    }
  }
)
```

Create `backend/src/workflows/steps/validate-wishlist-sales-channel.ts`:

```typescript
import { MedusaError } from "@medusajs/framework/utils"
import { createStep } from "@medusajs/framework/workflows-sdk"

type Input = {
  wishlist_sales_channel_id: string
  sales_channel_id: string
}

export const validateWishlistSalesChannelStep = createStep(
  "validate-wishlist-sales-channel",
  async ({ wishlist_sales_channel_id, sales_channel_id }: Input) => {
    // In single-sales-channel setups this always passes.
    // Validates that the wishlist belongs to the request's sales channel.
    if (wishlist_sales_channel_id !== sales_channel_id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Wishlist does not belong to the current sales channel"
      )
    }
  }
)
```

Create `backend/src/workflows/steps/validate-variant-wishlist.ts`:

```typescript
import { MedusaError } from "@medusajs/framework/utils"
import { createStep } from "@medusajs/framework/workflows-sdk"

type Input = {
  variant_id: string
  sales_channel_id: string
  wishlist_items: { product_variant_id: string }[]
}

export const validateVariantWishlistStep = createStep(
  "validate-variant-in-wishlist",
  async ({ variant_id, sales_channel_id, wishlist_items }: Input, { container }) => {
    const isInWishlist = wishlist_items.some(
      (item) => item.product_variant_id === variant_id
    )

    if (isInWishlist) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Variant is already in wishlist"
      )
    }

    const query = container.resolve("query")
    const { data } = await query.graph({
      entity: "variant",
      fields: ["product.sales_channels.*"],
      filters: { id: variant_id },
    })

    if (!data.length) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "Variant not found"
      )
    }

    const variantInSalesChannel = data[0].product.sales_channels.some(
      (sc: { id: string }) => sc.id === sales_channel_id
    )

    if (!variantInSalesChannel) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Variant is not available in the specified sales channel"
      )
    }
  }
)
```

Create `backend/src/workflows/steps/validate-item-in-wishlist.ts`:

```typescript
import { MedusaError } from "@medusajs/framework/utils"
import { createStep } from "@medusajs/framework/workflows-sdk"

type Input = {
  wishlist_items: { id: string }[]
  wishlist_item_id: string
}

export const validateItemInWishlistStep = createStep(
  "validate-item-in-wishlist",
  async ({ wishlist_items, wishlist_item_id }: Input) => {
    const item = wishlist_items.find((item) => item.id === wishlist_item_id)

    if (!item) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Item does not exist in this wishlist"
      )
    }
  }
)
```

**Step 2: Create mutation steps**

Create `backend/src/workflows/steps/create-wishlist.ts`:

```typescript
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { WISHLIST_MODULE } from "../../modules/wishlist"
import WishlistModuleService from "../../modules/wishlist/service"

export type CreateWishlistStepInput = {
  customer_id?: string
  sales_channel_id: string
  name?: string
}

export const createWishlistStep = createStep(
  "create-wishlist",
  async (input: CreateWishlistStepInput, { container }) => {
    const wishlistService: WishlistModuleService = container.resolve(WISHLIST_MODULE)
    const wishlist = await wishlistService.createWishlists(input)
    return new StepResponse(wishlist, wishlist.id)
  },
  async (id, { container }) => {
    if (!id) return
    const wishlistService: WishlistModuleService = container.resolve(WISHLIST_MODULE)
    await wishlistService.deleteWishlists(id)
  }
)
```

Create `backend/src/workflows/steps/create-wishlist-item.ts`:

```typescript
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { WISHLIST_MODULE } from "../../modules/wishlist"
import WishlistModuleService from "../../modules/wishlist/service"

export type CreateWishlistItemStepInput = {
  wishlist_id: string
  product_variant_id: string
}

export const createWishlistItemStep = createStep(
  "create-wishlist-item",
  async (input: CreateWishlistItemStepInput, { container }) => {
    const wishlistService: WishlistModuleService = container.resolve(WISHLIST_MODULE)
    const item = await wishlistService.createWishlistItems(input)
    return new StepResponse(item, item.id)
  },
  async (id, { container }) => {
    if (!id) return
    const wishlistService: WishlistModuleService = container.resolve(WISHLIST_MODULE)
    await wishlistService.deleteWishlistItems(id)
  }
)
```

Create `backend/src/workflows/steps/delete-wishlist-item.ts`:

```typescript
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { WISHLIST_MODULE } from "../../modules/wishlist"
import WishlistModuleService from "../../modules/wishlist/service"

type Input = { wishlist_item_id: string }

export const deleteWishlistItemStep = createStep(
  "delete-wishlist-item",
  async ({ wishlist_item_id }: Input, { container }) => {
    const wishlistService: WishlistModuleService = container.resolve(WISHLIST_MODULE)
    await wishlistService.softDeleteWishlistItems(wishlist_item_id)
    return new StepResponse(void 0, wishlist_item_id)
  },
  async (wishlistItemId, { container }) => {
    if (!wishlistItemId) return
    const wishlistService: WishlistModuleService = container.resolve(WISHLIST_MODULE)
    await wishlistService.restoreWishlistItems([wishlistItemId])
  }
)
```

Create `backend/src/workflows/steps/delete-wishlist.ts`:

```typescript
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { WISHLIST_MODULE } from "../../modules/wishlist"
import WishlistModuleService from "../../modules/wishlist/service"

type Input = { wishlist_id: string }

export const deleteWishlistStep = createStep(
  "delete-wishlist",
  async ({ wishlist_id }: Input, { container }) => {
    const wishlistService: WishlistModuleService = container.resolve(WISHLIST_MODULE)
    await wishlistService.softDeleteWishlists(wishlist_id)
    return new StepResponse(void 0, wishlist_id)
  },
  async (wishlistId, { container }) => {
    if (!wishlistId) return
    const wishlistService: WishlistModuleService = container.resolve(WISHLIST_MODULE)
    await wishlistService.restoreWishlists([wishlistId])
  }
)
```

Create `backend/src/workflows/steps/update-wishlist.ts`:

```typescript
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { WISHLIST_MODULE } from "../../modules/wishlist"
import WishlistModuleService from "../../modules/wishlist/service"

type Input = {
  wishlist_id: string
  name?: string
}

export const updateWishlistStep = createStep(
  "update-wishlist",
  async ({ wishlist_id, ...data }: Input, { container }) => {
    const wishlistService: WishlistModuleService = container.resolve(WISHLIST_MODULE)
    const [existing] = await wishlistService.listWishlists({ id: wishlist_id })
    const previousName = existing?.name
    await wishlistService.updateWishlists({ id: wishlist_id, ...data })
    const updated = await wishlistService.retrieveWishlist(wishlist_id)
    return new StepResponse(updated, { wishlist_id, name: previousName })
  },
  async (compensationData, { container }) => {
    if (!compensationData) return
    const wishlistService: WishlistModuleService = container.resolve(WISHLIST_MODULE)
    await wishlistService.updateWishlists({
      id: compensationData.wishlist_id,
      name: compensationData.name,
    })
  }
)
```

Create `backend/src/workflows/steps/transfer-wishlist.ts`:

```typescript
import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { WISHLIST_MODULE } from "../../modules/wishlist"
import WishlistModuleService from "../../modules/wishlist/service"

type Input = {
  wishlist_id: string
  customer_id: string
}

export const transferWishlistStep = createStep(
  "transfer-wishlist",
  async ({ wishlist_id, customer_id }: Input, { container }) => {
    const wishlistService: WishlistModuleService = container.resolve(WISHLIST_MODULE)
    const wishlist = await wishlistService.retrieveWishlist(wishlist_id)

    if (wishlist.customer_id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "This wishlist is already assigned to a customer"
      )
    }

    await wishlistService.updateWishlists({ id: wishlist_id, customer_id })
    const updated = await wishlistService.retrieveWishlist(wishlist_id)
    return new StepResponse(updated, wishlist_id)
  },
  async (wishlistId, { container }) => {
    if (!wishlistId) return
    const wishlistService: WishlistModuleService = container.resolve(WISHLIST_MODULE)
    // Revert: set customer_id back to null
    await wishlistService.updateWishlists({ id: wishlistId, customer_id: null as any })
  }
)
```

**Step 3: Commit**

```bash
git add backend/src/workflows/steps/create-wishlist.ts backend/src/workflows/steps/create-wishlist-item.ts backend/src/workflows/steps/delete-wishlist.ts backend/src/workflows/steps/delete-wishlist-item.ts backend/src/workflows/steps/update-wishlist.ts backend/src/workflows/steps/transfer-wishlist.ts backend/src/workflows/steps/validate-wishlist-exists.ts backend/src/workflows/steps/validate-wishlist-sales-channel.ts backend/src/workflows/steps/validate-variant-wishlist.ts backend/src/workflows/steps/validate-item-in-wishlist.ts
git commit -m "feat: add wishlist workflow steps with compensation

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Workflows

**Files:**
- Create: `backend/src/workflows/create-wishlist.ts`
- Create: `backend/src/workflows/create-wishlist-item.ts`
- Create: `backend/src/workflows/delete-wishlist-item.ts`
- Create: `backend/src/workflows/delete-wishlist.ts`
- Create: `backend/src/workflows/update-wishlist.ts`
- Create: `backend/src/workflows/transfer-wishlist.ts`

**Step 1: Create wishlist workflow**

Create `backend/src/workflows/create-wishlist.ts` — note this is distinct from the existing `create-review.ts`:

```typescript
import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { createWishlistStep, type CreateWishlistStepInput } from "./steps/create-wishlist"

export const createWishlistWorkflow = createWorkflow(
  "create-wishlist",
  (input: CreateWishlistStepInput) => {
    const wishlist = createWishlistStep(input)
    return new WorkflowResponse({ wishlist })
  }
)
```

**Step 2: Create wishlist item workflow**

Create `backend/src/workflows/create-wishlist-item.ts`:

```typescript
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { validateWishlistExistsStep } from "./steps/validate-wishlist-exists"
import { validateWishlistSalesChannelStep } from "./steps/validate-wishlist-sales-channel"
import { validateVariantWishlistStep } from "./steps/validate-variant-wishlist"
import { createWishlistItemStep } from "./steps/create-wishlist-item"

type CreateWishlistItemWorkflowInput = {
  variant_id: string
  wishlist_id: string
  sales_channel_id: string
}

export const createWishlistItemWorkflow = createWorkflow(
  "create-wishlist-item",
  (input: CreateWishlistItemWorkflowInput) => {
    const { data: wishlists } = useQueryGraphStep({
      entity: "wishlist",
      fields: ["*", "items.*"],
      filters: { id: input.wishlist_id },
    })

    validateWishlistExistsStep({ wishlists })

    const salesChannelInput = transform({ wishlists, input }, (data) => ({
      wishlist_sales_channel_id: data.wishlists[0].sales_channel_id,
      sales_channel_id: data.input.sales_channel_id,
    }))

    validateWishlistSalesChannelStep(salesChannelInput)

    const variantInput = transform({ wishlists, input }, (data) => ({
      variant_id: data.input.variant_id,
      sales_channel_id: data.input.sales_channel_id,
      wishlist_items: data.wishlists[0].items || [],
    }))

    validateVariantWishlistStep(variantInput)

    const itemInput = transform({ wishlists, input }, (data) => ({
      product_variant_id: data.input.variant_id,
      wishlist_id: data.wishlists[0].id,
    }))

    createWishlistItemStep(itemInput)

    const { data: updatedWishlists } = useQueryGraphStep({
      entity: "wishlist",
      fields: ["*", "items.*", "items.product_variant.*"],
      filters: { id: input.wishlist_id },
    }).config({ name: "refetch-wishlist" })

    return new WorkflowResponse(
      transform({ updatedWishlists }, (data) => ({
        wishlist: data.updatedWishlists[0],
      }))
    )
  }
)
```

**Step 3: Delete wishlist item workflow**

Create `backend/src/workflows/delete-wishlist-item.ts`:

```typescript
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { validateWishlistExistsStep } from "./steps/validate-wishlist-exists"
import { validateItemInWishlistStep } from "./steps/validate-item-in-wishlist"
import { deleteWishlistItemStep } from "./steps/delete-wishlist-item"

type DeleteWishlistItemWorkflowInput = {
  wishlist_item_id: string
  wishlist_id: string
}

export const deleteWishlistItemWorkflow = createWorkflow(
  "delete-wishlist-item",
  (input: DeleteWishlistItemWorkflowInput) => {
    const { data: wishlists } = useQueryGraphStep({
      entity: "wishlist",
      fields: ["*", "items.*"],
      filters: { id: input.wishlist_id },
    })

    validateWishlistExistsStep({ wishlists })

    const validateInput = transform({ wishlists, input }, (data) => ({
      wishlist_items: data.wishlists[0].items || [],
      wishlist_item_id: data.input.wishlist_item_id,
    }))

    validateItemInWishlistStep(validateInput)

    deleteWishlistItemStep({ wishlist_item_id: input.wishlist_item_id })

    const { data: updatedWishlists } = useQueryGraphStep({
      entity: "wishlist",
      fields: ["*", "items.*", "items.product_variant.*"],
      filters: { id: input.wishlist_id },
    }).config({ name: "refetch-wishlist" })

    return new WorkflowResponse(
      transform({ updatedWishlists }, (data) => ({
        wishlist: data.updatedWishlists[0],
      }))
    )
  }
)
```

**Step 4: Delete wishlist workflow**

Create `backend/src/workflows/delete-wishlist.ts`:

```typescript
import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { validateWishlistExistsStep } from "./steps/validate-wishlist-exists"
import { deleteWishlistStep } from "./steps/delete-wishlist"

type DeleteWishlistWorkflowInput = {
  wishlist_id: string
  customer_id: string
}

export const deleteWishlistWorkflow = createWorkflow(
  "delete-wishlist",
  (input: DeleteWishlistWorkflowInput) => {
    const { data: wishlists } = useQueryGraphStep({
      entity: "wishlist",
      fields: ["*"],
      filters: { id: input.wishlist_id, customer_id: input.customer_id },
    })

    validateWishlistExistsStep({ wishlists })

    deleteWishlistStep({ wishlist_id: input.wishlist_id })

    return new WorkflowResponse({ success: true })
  }
)
```

**Step 5: Update wishlist workflow**

Create `backend/src/workflows/update-wishlist.ts`:

```typescript
import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { validateWishlistExistsStep } from "./steps/validate-wishlist-exists"
import { updateWishlistStep } from "./steps/update-wishlist"

type UpdateWishlistWorkflowInput = {
  wishlist_id: string
  customer_id: string
  name?: string
}

export const updateWishlistWorkflow = createWorkflow(
  "update-wishlist",
  (input: UpdateWishlistWorkflowInput) => {
    const { data: wishlists } = useQueryGraphStep({
      entity: "wishlist",
      fields: ["*"],
      filters: { id: input.wishlist_id, customer_id: input.customer_id },
    })

    validateWishlistExistsStep({ wishlists })

    const wishlist = updateWishlistStep({
      wishlist_id: input.wishlist_id,
      name: input.name,
    })

    return new WorkflowResponse({ wishlist })
  }
)
```

**Step 6: Transfer wishlist workflow**

Create `backend/src/workflows/transfer-wishlist.ts`:

```typescript
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep, emitEventStep } from "@medusajs/medusa/core-flows"
import { validateWishlistExistsStep } from "./steps/validate-wishlist-exists"
import { validateWishlistSalesChannelStep } from "./steps/validate-wishlist-sales-channel"
import { transferWishlistStep } from "./steps/transfer-wishlist"

type TransferWishlistWorkflowInput = {
  wishlist_id: string
  customer_id: string
  sales_channel_id: string
}

export const transferWishlistWorkflow = createWorkflow(
  "transfer-wishlist",
  (input: TransferWishlistWorkflowInput) => {
    const { data: wishlists } = useQueryGraphStep({
      entity: "wishlist",
      fields: ["*"],
      filters: { id: input.wishlist_id },
    })

    validateWishlistExistsStep({ wishlists })

    // Validate the guest wishlist belongs to the same sales channel.
    // In single-sales-channel setups this always passes.
    const salesChannelInput = transform({ wishlists, input }, (data) => ({
      wishlist_sales_channel_id: data.wishlists[0].sales_channel_id,
      sales_channel_id: data.input.sales_channel_id,
    }))

    validateWishlistSalesChannelStep(salesChannelInput)

    const wishlist = transferWishlistStep({
      wishlist_id: input.wishlist_id,
      customer_id: input.customer_id,
    })

    const eventData = transform({ wishlist, input }, (data) => ({
      eventName: "wishlist.transferred" as const,
      data: {
        id: data.wishlist.id,
        customer_id: data.input.customer_id,
      },
    }))

    emitEventStep(eventData)

    return new WorkflowResponse({ wishlist })
  }
)
```

**Step 7: Verify backend compiles**

```bash
cd backend && bun run dev
```

Check for compilation errors. Fix any import issues.

**Step 8: Commit**

```bash
git add backend/src/workflows/create-wishlist.ts backend/src/workflows/create-wishlist-item.ts backend/src/workflows/delete-wishlist.ts backend/src/workflows/delete-wishlist-item.ts backend/src/workflows/update-wishlist.ts backend/src/workflows/transfer-wishlist.ts
git commit -m "feat: add wishlist workflows with validation and compensation

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: API Routes — Customer Wishlists

**Files:**
- Create: `backend/src/api/store/customers/me/wishlists/route.ts`
- Create: `backend/src/api/store/customers/me/wishlists/[id]/route.ts`
- Create: `backend/src/api/store/customers/me/wishlists/[id]/items/route.ts`
- Create: `backend/src/api/store/customers/me/wishlists/[id]/items/[itemId]/route.ts`
- Create: `backend/src/api/store/customers/me/wishlists/[id]/share/route.ts`
- Create: `backend/src/api/store/customers/me/wishlists/[id]/transfer/route.ts`
- Create: `backend/src/api/store/customers/me/wishlists/validators.ts`
- Modify: `backend/src/api/middlewares.ts`

**Step 1: Create validators**

Create `backend/src/api/store/customers/me/wishlists/validators.ts`:

```typescript
import { z } from "@medusajs/framework/zod"

export const PostCreateWishlistSchema = z.object({
  name: z.string().optional(),
})

export const PutUpdateWishlistSchema = z.object({
  name: z.string().optional(),
})

export const PostCreateWishlistItemSchema = z.object({
  variant_id: z.string(),
})
```

**Step 2: Create GET/POST `/store/customers/me/wishlists`**

Create `backend/src/api/store/customers/me/wishlists/route.ts`:

```typescript
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createWishlistWorkflow } from "../../../../../workflows/create-wishlist"
import { PostCreateWishlistSchema } from "./validators"

type PostReq = z.infer<typeof PostCreateWishlistSchema>

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const query = req.scope.resolve("query")

  const { data } = await query.graph({
    entity: "wishlist",
    fields: ["*", "items.*", "items.product_variant.*"],
    filters: {
      customer_id: req.auth_context.actor_id,
    },
  })

  res.json({ wishlists: data })
}

export async function POST(
  req: AuthenticatedMedusaRequest<PostReq>,
  res: MedusaResponse
) {
  if (!req.publishable_key_context?.sales_channel_ids.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "At least one sales channel ID is required"
    )
  }

  const { result } = await createWishlistWorkflow(req.scope).run({
    input: {
      customer_id: req.auth_context.actor_id,
      sales_channel_id: req.publishable_key_context.sales_channel_ids[0],
      name: req.validatedBody?.name,
    },
  })

  res.status(201).json({ wishlist: result.wishlist })
}
```

**Step 3: Create GET/PUT/DELETE `/store/customers/me/wishlists/:id`**

Create `backend/src/api/store/customers/me/wishlists/[id]/route.ts`:

```typescript
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { deleteWishlistWorkflow } from "../../../../../../workflows/delete-wishlist"
import { updateWishlistWorkflow } from "../../../../../../workflows/update-wishlist"
import { PutUpdateWishlistSchema } from "../validators"

type PutReq = z.infer<typeof PutUpdateWishlistSchema>

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const query = req.scope.resolve("query")

  const { data } = await query.graph({
    entity: "wishlist",
    fields: ["*", "items.*", "items.product_variant.*"],
    filters: {
      id: req.params.id,
      customer_id: req.auth_context.actor_id,
    },
  })

  if (!data.length) {
    return res.status(404).json({ message: "Wishlist not found" })
  }

  res.json({ wishlist: data[0] })
}

export async function PUT(
  req: AuthenticatedMedusaRequest<PutReq>,
  res: MedusaResponse
) {
  const { result } = await updateWishlistWorkflow(req.scope).run({
    input: {
      wishlist_id: req.params.id,
      customer_id: req.auth_context.actor_id,
      name: req.validatedBody?.name,
    },
  })

  res.json({ wishlist: result.wishlist })
}

export async function DELETE(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  await deleteWishlistWorkflow(req.scope).run({
    input: {
      wishlist_id: req.params.id,
      customer_id: req.auth_context.actor_id,
    },
  })

  res.json({ success: true })
}
```

**Step 4: Create POST/DELETE items routes**

Create `backend/src/api/store/customers/me/wishlists/[id]/items/route.ts`:

```typescript
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createWishlistItemWorkflow } from "../../../../../../../workflows/create-wishlist-item"
import { PostCreateWishlistItemSchema } from "../../validators"

type PostReq = z.infer<typeof PostCreateWishlistItemSchema>

export async function POST(
  req: AuthenticatedMedusaRequest<PostReq>,
  res: MedusaResponse
) {
  if (!req.publishable_key_context?.sales_channel_ids.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "At least one sales channel ID is required"
    )
  }

  const { result } = await createWishlistItemWorkflow(req.scope).run({
    input: {
      variant_id: req.validatedBody.variant_id,
      wishlist_id: req.params.id,
      sales_channel_id: req.publishable_key_context.sales_channel_ids[0],
    },
  })

  res.json({ wishlist: result.wishlist })
}
```

Create `backend/src/api/store/customers/me/wishlists/[id]/items/[itemId]/route.ts`:

```typescript
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { deleteWishlistItemWorkflow } from "../../../../../../../../workflows/delete-wishlist-item"

export async function DELETE(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const { result } = await deleteWishlistItemWorkflow(req.scope).run({
    input: {
      wishlist_item_id: req.params.itemId,
      wishlist_id: req.params.id,
    },
  })

  res.json({ wishlist: result.wishlist })
}
```

**Step 5: Create share route**

Create `backend/src/api/store/customers/me/wishlists/[id]/share/route.ts`:

```typescript
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import jwt from "jsonwebtoken"

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const query = req.scope.resolve("query")

  const { data } = await query.graph({
    entity: "wishlist",
    fields: ["*"],
    filters: {
      id: req.params.id,
      customer_id: req.auth_context.actor_id,
    },
  })

  if (!data.length) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Wishlist not found")
  }

  const { http } = req.scope.resolve("configModule").projectConfig

  const token = jwt.sign(
    { wishlist_id: data[0].id },
    http.jwtSecret!,
    { expiresIn: "7d" }
  )

  res.json({ token })
}
```

**Step 6: Create transfer route**

Create `backend/src/api/store/customers/me/wishlists/[id]/transfer/route.ts`:

```typescript
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { transferWishlistWorkflow } from "../../../../../../../workflows/transfer-wishlist"

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  if (!req.publishable_key_context?.sales_channel_ids.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "At least one sales channel ID is required"
    )
  }

  const { result } = await transferWishlistWorkflow(req.scope).run({
    input: {
      wishlist_id: req.params.id,
      customer_id: req.auth_context.actor_id,
      sales_channel_id: req.publishable_key_context.sales_channel_ids[0],
    },
  })

  res.json({ wishlist: result.wishlist })
}
```

**Step 7: Update middleware**

Modify `backend/src/api/middlewares.ts` — add wishlist routes to the existing `defineMiddlewares` config. Add these entries to the `routes` array:

```typescript
// Add these imports at the top:
import {
  PostCreateWishlistSchema,
  PutUpdateWishlistSchema,
  PostCreateWishlistItemSchema,
} from "./store/customers/me/wishlists/validators"

// Add these to the routes array:
{
  matcher: "/store/customers/me/wishlists",
  method: ["POST"],
  middlewares: [
    authenticate("customer", ["session", "bearer"]),
    validateAndTransformBody(PostCreateWishlistSchema),
  ],
},
{
  matcher: "/store/customers/me/wishlists",
  method: ["GET"],
  middlewares: [
    authenticate("customer", ["session", "bearer"]),
  ],
},
{
  matcher: "/store/customers/me/wishlists/:id",
  middlewares: [
    authenticate("customer", ["session", "bearer"]),
  ],
},
{
  matcher: "/store/customers/me/wishlists/:id",
  method: ["PUT"],
  middlewares: [
    authenticate("customer", ["session", "bearer"]),
    validateAndTransformBody(PutUpdateWishlistSchema),
  ],
},
{
  matcher: "/store/customers/me/wishlists/:id/items",
  method: ["POST"],
  middlewares: [
    authenticate("customer", ["session", "bearer"]),
    validateAndTransformBody(PostCreateWishlistItemSchema),
  ],
},
{
  matcher: "/store/customers/me/wishlists/:id/items/:itemId",
  middlewares: [
    authenticate("customer", ["session", "bearer"]),
  ],
},
{
  matcher: "/store/customers/me/wishlists/:id/share",
  middlewares: [
    authenticate("customer", ["session", "bearer"]),
  ],
},
{
  matcher: "/store/customers/me/wishlists/:id/transfer",
  middlewares: [
    authenticate("customer", ["session", "bearer"]),
  ],
},
```

**Step 8: Install jsonwebtoken**

```bash
cd backend && bun add jsonwebtoken && bun add -d @types/jsonwebtoken
```

**Step 9: Verify with curl**

Start backend, then test:

```bash
# Get auth token first
TOKEN=$(curl -s -X POST 'http://localhost:9000/auth/customer/emailpass' \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"password"}' | jq -r '.token')

API_KEY="<your-publishable-key>"

# Create wishlist
curl -X POST 'http://localhost:9000/store/customers/me/wishlists' \
  -H "Content-Type: application/json" \
  -H "x-publishable-api-key: $API_KEY" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"My Favorites"}'

# List wishlists
curl 'http://localhost:9000/store/customers/me/wishlists' \
  -H "x-publishable-api-key: $API_KEY" \
  -H "Authorization: Bearer $TOKEN"
```

Expected: 201 with `{ wishlist: { id: "wl_...", name: "My Favorites", ... } }` and 200 with `{ wishlists: [...] }`.

**Step 10: Commit**

```bash
git add backend/src/api/store/customers/me/wishlists/ backend/src/api/middlewares.ts backend/package.json backend/bun.lock
git commit -m "feat: add customer wishlist API routes with validation

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: API Routes — Guest Wishlists & Shared Wishlists

**Files:**
- Create: `backend/src/api/store/wishlists/route.ts`
- Create: `backend/src/api/store/wishlists/[id]/route.ts`
- Create: `backend/src/api/store/wishlists/[id]/items/route.ts`
- Create: `backend/src/api/store/wishlists/[id]/items/[itemId]/route.ts`
- Create: `backend/src/api/store/wishlists/shared/[token]/route.ts`
- Create: `backend/src/api/store/wishlists/import/route.ts`
- Create: `backend/src/api/store/wishlists/validators.ts`
- Modify: `backend/src/api/middlewares.ts`

**Step 1: Create guest validators**

Create `backend/src/api/store/wishlists/validators.ts`:

```typescript
import { z } from "@medusajs/framework/zod"

export const PostGuestCreateWishlistItemSchema = z.object({
  variant_id: z.string(),
})

export const PostImportWishlistSchema = z.object({
  share_token: z.string(),
})
```

**Step 2: Create guest wishlist POST**

Create `backend/src/api/store/wishlists/route.ts`:

```typescript
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { createWishlistWorkflow } from "../../../workflows/create-wishlist"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  if (!req.publishable_key_context?.sales_channel_ids.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "At least one sales channel ID is required"
    )
  }

  const { result } = await createWishlistWorkflow(req.scope).run({
    input: {
      sales_channel_id: req.publishable_key_context.sales_channel_ids[0],
      // No customer_id — this is a guest wishlist
    },
  })

  res.status(201).json({ wishlist: result.wishlist })
}
```

**Step 3: Create guest wishlist GET by ID**

Create `backend/src/api/store/wishlists/[id]/route.ts`:

```typescript
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve("query")

  const { data } = await query.graph({
    entity: "wishlist",
    fields: ["*", "items.*", "items.product_variant.*"],
    filters: { id: req.params.id },
  })

  if (!data.length) {
    return res.status(404).json({ message: "Wishlist not found" })
  }

  res.json({ wishlist: data[0] })
}
```

**Step 4: Create guest item routes**

Create `backend/src/api/store/wishlists/[id]/items/route.ts`:

```typescript
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createWishlistItemWorkflow } from "../../../../../workflows/create-wishlist-item"
import { PostGuestCreateWishlistItemSchema } from "../../validators"

type PostReq = z.infer<typeof PostGuestCreateWishlistItemSchema>

export async function POST(req: MedusaRequest<PostReq>, res: MedusaResponse) {
  if (!req.publishable_key_context?.sales_channel_ids.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "At least one sales channel ID is required"
    )
  }

  const { result } = await createWishlistItemWorkflow(req.scope).run({
    input: {
      variant_id: req.validatedBody.variant_id,
      wishlist_id: req.params.id,
      sales_channel_id: req.publishable_key_context.sales_channel_ids[0],
    },
  })

  res.json({ wishlist: result.wishlist })
}
```

Create `backend/src/api/store/wishlists/[id]/items/[itemId]/route.ts`:

```typescript
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { deleteWishlistItemWorkflow } from "../../../../../../workflows/delete-wishlist-item"

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const { result } = await deleteWishlistItemWorkflow(req.scope).run({
    input: {
      wishlist_item_id: req.params.itemId,
      wishlist_id: req.params.id,
    },
  })

  res.json({ wishlist: result.wishlist })
}
```

**Step 5: Create shared wishlist route**

Create `backend/src/api/store/wishlists/shared/[token]/route.ts`:

```typescript
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import jwt, { TokenExpiredError } from "jsonwebtoken"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { http } = req.scope.resolve("configModule").projectConfig

  let decoded: { wishlist_id: string }
  try {
    decoded = jwt.verify(req.params.token, http.jwtSecret!) as { wishlist_id: string }
  } catch (e) {
    if (e instanceof TokenExpiredError) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "This wishlist link has expired. Ask the owner to share a new link."
      )
    }
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid share link")
  }

  const query = req.scope.resolve("query")

  const { data } = await query.graph({
    entity: "wishlist",
    fields: ["*", "items.*", "items.product_variant.*"],
    filters: { id: decoded.wishlist_id },
  })

  if (!data.length) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Wishlist not found")
  }

  res.json({ wishlist: data[0] })
}
```

**Step 6: Create import route**

Create `backend/src/api/store/wishlists/import/route.ts`:

```typescript
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import jwt, { TokenExpiredError } from "jsonwebtoken"
import { WISHLIST_MODULE } from "../../../../modules/wishlist"
import WishlistModuleService from "../../../../modules/wishlist/service"
import { PostImportWishlistSchema } from "../validators"

type PostReq = z.infer<typeof PostImportWishlistSchema>

export async function POST(
  req: AuthenticatedMedusaRequest<PostReq>,
  res: MedusaResponse
) {
  if (!req.publishable_key_context?.sales_channel_ids.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "At least one sales channel ID is required"
    )
  }

  const { http } = req.scope.resolve("configModule").projectConfig

  let decoded: { wishlist_id: string }
  try {
    decoded = jwt.verify(req.validatedBody.share_token, http.jwtSecret!) as { wishlist_id: string }
  } catch (e) {
    if (e instanceof TokenExpiredError) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "This share link has expired"
      )
    }
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid share token")
  }

  const query = req.scope.resolve("query")
  const wishlistService: WishlistModuleService = req.scope.resolve(WISHLIST_MODULE)

  // Fetch source wishlist
  const { data } = await query.graph({
    entity: "wishlist",
    fields: ["*", "items.*"],
    filters: { id: decoded.wishlist_id },
  })

  if (!data.length) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Source wishlist not found")
  }

  const source = data[0]

  // Clone: create new wishlist for this customer
  const newWishlist = await wishlistService.createWishlists({
    customer_id: req.auth_context.actor_id,
    sales_channel_id: req.publishable_key_context.sales_channel_ids[0],
    name: source.name ? `${source.name} (imported)` : "Imported Wishlist",
  })

  // Clone items
  if (source.items?.length) {
    for (const item of source.items) {
      try {
        await wishlistService.createWishlistItems({
          wishlist_id: newWishlist.id,
          product_variant_id: item.product_variant_id,
        })
      } catch {
        // Skip duplicates or invalid variants
      }
    }
  }

  // Fetch the complete new wishlist
  const { data: result } = await query.graph({
    entity: "wishlist",
    fields: ["*", "items.*", "items.product_variant.*"],
    filters: { id: newWishlist.id },
  })

  res.status(201).json({ wishlist: result[0] })
}
```

**Step 7: Update middleware for guest routes**

Add to `backend/src/api/middlewares.ts` routes array:

```typescript
// Add imports:
import {
  PostGuestCreateWishlistItemSchema,
  PostImportWishlistSchema,
} from "./store/wishlists/validators"

// Guest routes — no auth required
{
  matcher: "/store/wishlists/:id/items",
  method: ["POST"],
  middlewares: [
    validateAndTransformBody(PostGuestCreateWishlistItemSchema),
  ],
},
// Import route — requires auth
{
  matcher: "/store/wishlists/import",
  method: ["POST"],
  middlewares: [
    authenticate("customer", ["session", "bearer"]),
    validateAndTransformBody(PostImportWishlistSchema),
  ],
},
```

**Step 8: Verify with curl**

```bash
API_KEY="<your-publishable-key>"

# Create guest wishlist
curl -X POST 'http://localhost:9000/store/wishlists' \
  -H "x-publishable-api-key: $API_KEY"

# Get guest wishlist by ID
curl 'http://localhost:9000/store/wishlists/<wl_id>' \
  -H "x-publishable-api-key: $API_KEY"
```

**Step 9: Commit**

```bash
git add backend/src/api/store/wishlists/ backend/src/api/middlewares.ts
git commit -m "feat: add guest wishlist and shared wishlist API routes

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: Storefront — Cookie, Constants, Types

**Files:**
- Modify: `storefront/lib/medusa/cookies.ts`
- Modify: `storefront/lib/constants.ts`
- Modify: `storefront/lib/types.ts`

**Step 1: Add wishlist cookie functions**

Add to `storefront/lib/medusa/cookies.ts` after the Auth Token section:

```typescript
// --- Wishlist Cookie (guest wishlist ID) ---

const WISHLIST_COOKIE = "_medusa_wishlist_id";

export async function getWishlistId(): Promise<string | undefined> {
  const cookies = await nextCookies();
  return cookies.get(WISHLIST_COOKIE)?.value;
}

export async function setWishlistId(wishlistId: string): Promise<void> {
  const cookies = await nextCookies();
  cookies.set(WISHLIST_COOKIE, wishlistId, {
    maxAge: 60 * 60 * 24 * 30, // 30 days
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function removeWishlistId(): Promise<void> {
  const cookies = await nextCookies();
  cookies.set(WISHLIST_COOKIE, "", { maxAge: -1 });
}
```

**Step 2: Add wishlist cache tag**

Modify `storefront/lib/constants.ts` — add `wishlists` to TAGS:

```typescript
export const TAGS = {
  collections: "collections",
  products: "products",
  cart: "cart",
  customers: "customers",
  reviews: "reviews",
  wishlists: "wishlists",
};
```

**Step 3: Add wishlist types**

Add to `storefront/lib/types.ts`:

```typescript
export type WishlistItem = {
  id: string;
  product_variant_id: string;
  wishlist_id: string;
  product_variant?: {
    id: string;
    title: string;
    sku: string;
    product_id: string;
    product?: Product;
  };
  created_at: string;
};

export type Wishlist = {
  id: string;
  name: string | null;
  customer_id: string | null;
  sales_channel_id: string;
  items: WishlistItem[];
  created_at: string;
  updated_at: string;
};
```

**Step 4: Commit**

```bash
git add storefront/lib/medusa/cookies.ts storefront/lib/constants.ts storefront/lib/types.ts
git commit -m "feat: add wishlist cookie, cache tag, and types

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: Storefront — Server Actions

**Files:**
- Create: `storefront/lib/medusa/wishlist.ts`
- Modify: `storefront/lib/medusa/customer.ts`

**Step 1: Create wishlist server actions**

Create `storefront/lib/medusa/wishlist.ts` — follow patterns from `customer.ts` and `reviews.ts`:

```typescript
"use server";

import { sdk } from "lib/medusa";
import { TAGS } from "lib/constants";
import type { Wishlist } from "lib/types";
import { revalidatePath, revalidateTag } from "next/cache";
import { cacheLife, cacheTag } from "next/cache";
import {
  getAuthHeaders,
  getAuthToken,
  getWishlistId,
  setWishlistId,
  removeWishlistId,
} from "lib/medusa/cookies";

export type WishlistActionResult = { error?: string; success?: boolean } | null;

type WishlistResponse = { wishlist: Wishlist };
type WishlistsResponse = { wishlists: Wishlist[] };

function revalidateWishlists(): void {
  revalidateTag(TAGS.wishlists, "max");
  revalidatePath("/", "layout");
}

// --- Read Operations ---

export async function getWishlists(): Promise<Wishlist[]> {
  "use cache";
  cacheTag(TAGS.wishlists);
  cacheLife("days");

  const token = await getAuthToken();
  const headers = await getAuthHeaders();

  if (token) {
    // Authenticated: fetch all customer wishlists
    try {
      const result = await sdk.client.fetch<WishlistsResponse>(
        "/store/customers/me/wishlists",
        { method: "GET", headers }
      );
      return result.wishlists;
    } catch {
      return [];
    }
  }

  // Guest: fetch single wishlist by cookie ID
  const wishlistId = await getWishlistId();
  if (!wishlistId) return [];

  try {
    const result = await sdk.client.fetch<WishlistResponse>(
      `/store/wishlists/${wishlistId}`,
      { method: "GET" }
    );
    return [result.wishlist];
  } catch {
    return [];
  }
}

export async function getWishlist(wishlistId: string): Promise<Wishlist | null> {
  "use cache";
  cacheTag(TAGS.wishlists);
  cacheLife("days");

  const headers = await getAuthHeaders();

  try {
    const result = await sdk.client.fetch<WishlistResponse>(
      `/store/wishlists/${wishlistId}`,
      { method: "GET", headers }
    );
    return result.wishlist;
  } catch {
    return null;
  }
}

export async function getSharedWishlist(token: string): Promise<Wishlist | null> {
  try {
    const result = await sdk.client.fetch<WishlistResponse>(
      `/store/wishlists/shared/${token}`,
      { method: "GET" }
    );
    return result.wishlist;
  } catch {
    return null;
  }
}

export async function isVariantInWishlist(variantId: string): Promise<boolean> {
  const wishlists = await getWishlists();
  return wishlists.some((wl) =>
    wl.items?.some((item) => item.product_variant_id === variantId)
  );
}

export async function getWishlistItemCount(): Promise<number> {
  const wishlists = await getWishlists();
  return wishlists.reduce((sum, wl) => sum + (wl.items?.length ?? 0), 0);
}

// --- Mutations ---

export async function createWishlist(
  prevState: WishlistActionResult,
  formData: FormData,
): Promise<WishlistActionResult> {
  const name = formData.get("name") as string | null;
  const headers = await getAuthHeaders();

  try {
    await sdk.client.fetch<WishlistResponse>(
      "/store/customers/me/wishlists",
      { method: "POST", headers, body: { name: name || undefined } }
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error creating wishlist" };
  } finally {
    revalidateWishlists();
  }

  return { success: true };
}

export async function addToWishlist(
  prevState: WishlistActionResult,
  formData: FormData,
): Promise<WishlistActionResult> {
  const variantId = formData.get("variant_id") as string;
  let wishlistId = formData.get("wishlist_id") as string | null;

  if (!variantId) return { error: "Variant ID is required" };

  const token = await getAuthToken();
  const headers = await getAuthHeaders();

  if (token) {
    // Authenticated flow
    if (!wishlistId) {
      // Auto-target: if customer has exactly one wishlist, use it
      const wishlists = await getWishlists();
      if (wishlists.length === 1) {
        wishlistId = wishlists[0]!.id;
      } else if (wishlists.length === 0) {
        // Auto-create a default wishlist
        try {
          const result = await sdk.client.fetch<WishlistResponse>(
            "/store/customers/me/wishlists",
            { method: "POST", headers, body: { name: "My Wishlist" } }
          );
          wishlistId = result.wishlist.id;
        } catch (e) {
          return { error: e instanceof Error ? e.message : "Error creating wishlist" };
        }
      } else {
        return { error: "Please select a wishlist" };
      }
    }

    try {
      await sdk.client.fetch<WishlistResponse>(
        `/store/customers/me/wishlists/${wishlistId}/items`,
        { method: "POST", headers, body: { variant_id: variantId } }
      );
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Error adding to wishlist" };
    } finally {
      revalidateWishlists();
    }
  } else {
    // Guest flow — lazy create guest wishlist
    let guestWishlistId = await getWishlistId();

    if (!guestWishlistId) {
      try {
        const result = await sdk.client.fetch<WishlistResponse>(
          "/store/wishlists",
          { method: "POST" }
        );
        guestWishlistId = result.wishlist.id;
        await setWishlistId(guestWishlistId);
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Error creating wishlist" };
      }
    }

    try {
      await sdk.client.fetch<WishlistResponse>(
        `/store/wishlists/${guestWishlistId}/items`,
        { method: "POST", body: { variant_id: variantId } }
      );
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Error adding to wishlist" };
    } finally {
      revalidateWishlists();
    }
  }

  return { success: true };
}

export async function removeFromWishlist(
  prevState: WishlistActionResult,
  formData: FormData,
): Promise<WishlistActionResult> {
  const wishlistId = formData.get("wishlist_id") as string;
  const itemId = formData.get("item_id") as string;

  if (!wishlistId || !itemId) return { error: "Missing wishlist or item ID" };

  const token = await getAuthToken();
  const headers = await getAuthHeaders();

  try {
    const basePath = token
      ? `/store/customers/me/wishlists/${wishlistId}/items/${itemId}`
      : `/store/wishlists/${wishlistId}/items/${itemId}`;

    await sdk.client.fetch(basePath, { method: "DELETE", headers });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error removing item" };
  } finally {
    revalidateWishlists();
  }

  return { success: true };
}

export async function deleteWishlist(
  prevState: WishlistActionResult,
  formData: FormData,
): Promise<WishlistActionResult> {
  const wishlistId = formData.get("wishlist_id") as string;
  if (!wishlistId) return { error: "Wishlist ID is required" };

  const headers = await getAuthHeaders();

  try {
    await sdk.client.fetch(
      `/store/customers/me/wishlists/${wishlistId}`,
      { method: "DELETE", headers }
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error deleting wishlist" };
  } finally {
    revalidateWishlists();
  }

  return { success: true };
}

export async function renameWishlist(
  prevState: WishlistActionResult,
  formData: FormData,
): Promise<WishlistActionResult> {
  const wishlistId = formData.get("wishlist_id") as string;
  const name = formData.get("name") as string;

  if (!wishlistId) return { error: "Wishlist ID is required" };

  const headers = await getAuthHeaders();

  try {
    await sdk.client.fetch(
      `/store/customers/me/wishlists/${wishlistId}`,
      { method: "PUT", headers, body: { name } }
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error renaming wishlist" };
  } finally {
    revalidateWishlists();
  }

  return { success: true };
}

export async function transferWishlist(): Promise<void> {
  const guestWishlistId = await getWishlistId();
  if (!guestWishlistId) return;

  const headers = await getAuthHeaders();

  try {
    await sdk.client.fetch(
      `/store/customers/me/wishlists/${guestWishlistId}/transfer`,
      { method: "POST", headers }
    );
  } catch {
    // Transfer is best-effort
  } finally {
    await removeWishlistId();
    revalidateWishlists();
  }
}

export async function shareWishlist(wishlistId: string): Promise<string | null> {
  const headers = await getAuthHeaders();

  try {
    const result = await sdk.client.fetch<{ token: string }>(
      `/store/customers/me/wishlists/${wishlistId}/share`,
      { method: "POST", headers }
    );
    return result.token;
  } catch {
    return null;
  }
}
```

**Step 2: Integrate transfer into login/signup**

Modify `storefront/lib/medusa/customer.ts`:

Add import at top:
```typescript
import { transferWishlist } from "lib/medusa/wishlist";
```

In `login()`, after the `transferCart()` try/catch block (around line 73-77), add:

```typescript
  try {
    await transferWishlist();
  } catch {
    // Wishlist transfer is best-effort — don't block login
  }
```

In `signup()`, after the `transferCart()` try/catch block (around line 150-154), add the same block.

In `signout()`, add after `removeCartId()`:
```typescript
import { removeWishlistId } from "lib/medusa/cookies";
// ...
await removeWishlistId();
// ...
revalidateTag(TAGS.wishlists, "max");
```

**Step 3: Verify storefront compiles**

```bash
cd storefront && bun dev
```

Check for TypeScript errors.

**Step 4: Commit**

```bash
git add storefront/lib/medusa/wishlist.ts storefront/lib/medusa/customer.ts
git commit -m "feat: add wishlist server actions and auth integration

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 9: UI — Wishlist Heart Button Component

**Files:**
- Create: `storefront/components/wishlist/wishlist-button.tsx`

**Step 1: Create the heart toggle component**

Reference TailwindUI: `Ecommerce > Components > Product Overviews > With image gallery and expandable details` for the HeartIcon pattern.

Create `storefront/components/wishlist/wishlist-button.tsx`:

```typescript
"use client";

import { HeartIcon as HeartOutline } from "@heroicons/react/24/outline";
import { HeartIcon as HeartSolid } from "@heroicons/react/24/solid";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { addToWishlist, removeFromWishlist, type WishlistActionResult } from "lib/medusa/wishlist";
import { useNotification } from "components/notifications";
import clsx from "clsx";

type WishlistButtonProps = {
  variantId: string;
  isInWishlist?: boolean;
  wishlistId?: string;
  wishlistItemId?: string;
  size?: "sm" | "md";
  className?: string;
};

export function WishlistButton({
  variantId,
  isInWishlist: initialIsInWishlist = false,
  wishlistId,
  wishlistItemId,
  size = "md",
  className,
}: WishlistButtonProps) {
  const [isWishlisted, setIsWishlisted] = useState(initialIsInWishlist);
  const [isPending, startTransition] = useTransition();
  const { showNotification } = useNotification();

  useEffect(() => {
    setIsWishlisted(initialIsInWishlist);
  }, [initialIsInWishlist]);

  function handleClick() {
    startTransition(async () => {
      if (isWishlisted && wishlistId && wishlistItemId) {
        const formData = new FormData();
        formData.set("wishlist_id", wishlistId);
        formData.set("item_id", wishlistItemId);
        const result = await removeFromWishlist(null, formData);
        if (result?.error) {
          showNotification("error", "Could not remove from wishlist", result.error);
        } else {
          setIsWishlisted(false);
          showNotification("success", "Removed from wishlist");
        }
      } else {
        const formData = new FormData();
        formData.set("variant_id", variantId);
        if (wishlistId) formData.set("wishlist_id", wishlistId);
        const result = await addToWishlist(null, formData);
        if (result?.error) {
          showNotification("error", "Could not add to wishlist", result.error);
        } else {
          setIsWishlisted(true);
          showNotification("success", "Added to wishlist");
        }
      }
    });
  }

  const iconSize = size === "sm" ? "size-5" : "size-6";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={clsx(
        "group/heart rounded-full p-2 transition-colors",
        isWishlisted
          ? "text-red-500 hover:text-red-600"
          : "text-gray-400 hover:text-red-500",
        isPending && "opacity-50",
        className,
      )}
      aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
    >
      {isWishlisted ? (
        <HeartSolid className={clsx(iconSize, isPending && "animate-pulse")} />
      ) : (
        <HeartOutline className={clsx(iconSize, "group-hover/heart:fill-red-100")} />
      )}
    </button>
  );
}
```

**Step 2: Commit**

```bash
git add storefront/components/wishlist/wishlist-button.tsx
git commit -m "feat: add wishlist heart toggle button component

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 10: UI — Integrate Heart Button into Product Cards & PDP

**Files:**
- Modify: `storefront/components/layout/product-grid.tsx` (heart overlay on cards)
- Modify: `storefront/components/product/product-detail.tsx` (heart next to add-to-cart)

**Step 1: Add heart button to product grid cards**

In `storefront/components/layout/product-grid.tsx`, add the heart button as an overlay in the top-right corner of each product card image container.

Import `WishlistButton` and add it inside the image `<div>` with absolute positioning:

```typescript
import { WishlistButton } from "components/wishlist/wishlist-button";
```

Inside the image container (the `relative aspect-square` div), add:

```typescript
<div className="absolute right-2 top-2 z-10">
  <WishlistButton
    variantId={product.variants[0]?.id ?? ""}
    size="sm"
    className="bg-white/80 shadow-sm backdrop-blur-sm hover:bg-white"
  />
</div>
```

Note: Uses first variant ID as default. The heart will be non-functional if no variants exist.

**Step 2: Add heart button to product detail page**

In `storefront/components/product/product-detail.tsx`, add the heart button next to the product title or the add-to-cart button.

Import `WishlistButton` and the product context to get the selected variant:

```typescript
import { WishlistButton } from "components/wishlist/wishlist-button";
```

Add the heart button next to the "Add to bag" button area. The exact placement depends on the existing layout — look for the `AddToCart` button and place the heart button adjacent to it in a flex container.

**Step 3: Verify in browser**

Navigate to the storefront, check that heart icons appear on product cards and the PDP. Click a heart — should toggle and show notification.

**Step 4: Commit**

```bash
git add storefront/components/layout/product-grid.tsx storefront/components/product/product-detail.tsx
git commit -m "feat: integrate wishlist heart button into product cards and PDP

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 11: UI — Account Wishlist Page

**Files:**
- Create: `storefront/app/account/wishlist/page.tsx`
- Modify: `storefront/components/account/account-tabs.tsx`

**Step 1: Add wishlist tab to account navigation**

Modify `storefront/components/account/account-tabs.tsx` — add to the `tabs` array:

```typescript
const tabs = [
  { name: "Profile", href: "/account" },
  { name: "Orders", href: "/account/orders" },
  { name: "Addresses", href: "/account/addresses" },
  { name: "Wishlist", href: "/account/wishlist" },
];
```

**Step 2: Create the wishlist page**

Reference TailwindUI: `Ecommerce > Components > Product Lists > With image overlay and add button` for the grid, `Application UI > Feedback > Empty States > Simple` for empty state.

Create `storefront/app/account/wishlist/page.tsx`:

```typescript
import { getWishlists } from "lib/medusa/wishlist";
import { WishlistPageClient } from "components/wishlist/wishlist-page-client";

export default async function WishlistPage() {
  const wishlists = await getWishlists();
  return <WishlistPageClient wishlists={wishlists} />;
}
```

Then create `storefront/components/wishlist/wishlist-page-client.tsx` as a `"use client"` component that:

- Shows tabs if multiple wishlists (using TailwindUI tabs with underline and badges)
- Shows a product grid for each wishlist's items
- Each item shows: product image, name, variant info, price, "Add to cart" button, remove button
- "Add to cart" calls the existing `addItem` server action from `components/cart/actions.ts`
- Remove calls `removeFromWishlist`
- "New Wishlist" button to create named wishlists
- "Share" button per wishlist
- Empty state with HeartIcon when no items

This is a large component — implement the basic structure first, then iterate on styling.

**Step 3: Verify in browser**

Log in, navigate to `/account/wishlist`. Should show empty state initially. Add items via heart buttons, then verify they appear on the wishlist page.

**Step 4: Commit**

```bash
git add storefront/app/account/wishlist/ storefront/components/wishlist/wishlist-page-client.tsx storefront/components/account/account-tabs.tsx
git commit -m "feat: add account wishlist page with grid, empty state, and actions

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 12: UI — Shared Wishlist Page

**Files:**
- Create: `storefront/app/(store)/wishlist/shared/[token]/page.tsx`

**Step 1: Create the shared wishlist page**

Create `storefront/app/(store)/wishlist/shared/[token]/page.tsx`:

```typescript
import { getSharedWishlist } from "lib/medusa/wishlist";
import { notFound } from "next/navigation";

export default async function SharedWishlistPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const wishlist = await getSharedWishlist(token);

  if (!wishlist) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900">
        {wishlist.name || "Shared Wishlist"}
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        {wishlist.items?.length ?? 0} items
      </p>
      {/* Render items as a read-only product grid */}
      {/* Add "Import to my wishlist" button for authenticated users */}
    </div>
  );
}
```

Implement the full read-only grid and import button. The import button calls `sdk.client.fetch("/store/wishlists/import", { method: "POST", body: { share_token: token } })`.

**Step 2: Commit**

```bash
git add storefront/app/(store)/wishlist/
git commit -m "feat: add shared wishlist page with read-only view and import

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 13: Admin Widget — Wishlist Count

**Files:**
- Modify: `backend/src/modules/wishlist/service.ts`
- Create: `backend/src/api/admin/products/[id]/wishlist/route.ts`
- Create: `backend/src/admin/widgets/product-wishlist-widget.tsx`

**Step 1: Add custom service method**

Add to `backend/src/modules/wishlist/service.ts`:

```typescript
import { MedusaService, InjectManager, MedusaContext } from "@medusajs/framework/utils"
import type { Context } from "@medusajs/framework/types"

class WishlistModuleService extends MedusaService({
  Wishlist,
  WishlistItem,
}) {
  @InjectManager()
  async getWishlistsOfVariants(
    variantIds: string[],
    @MedusaContext() context: Context = {}
  ): Promise<number> {
    if (!variantIds.length) return 0
    return (await (context as any).manager?.createQueryBuilder("wishlist_item", "wi")
      .select(["wi.wishlist_id"], true)
      .where("wi.product_variant_id IN (?)", [variantIds])
      .execute())?.length || 0
  }
}
```

**Step 2: Create admin API route**

Create `backend/src/api/admin/products/[id]/wishlist/route.ts`:

```typescript
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { WISHLIST_MODULE } from "../../../../../modules/wishlist"
import WishlistModuleService from "../../../../../modules/wishlist/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const query = req.scope.resolve("query")
  const wishlistService: WishlistModuleService = req.scope.resolve(WISHLIST_MODULE)

  const { data: [product] } = await query.graph({
    entity: "product",
    fields: ["variants.*"],
    filters: { id },
  })

  if (!product) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Product not found`)
  }

  const count = await wishlistService.getWishlistsOfVariants(
    product.variants.map((v: { id: string }) => v.id)
  )

  res.json({ count })
}
```

**Step 3: Create admin widget**

Create `backend/src/admin/widgets/product-wishlist-widget.tsx`:

```tsx
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { sdk } from "../lib/sdk"
import type { DetailWidgetProps, AdminProduct } from "@medusajs/framework/types"

const ProductWishlistWidget = ({
  data: product,
}: DetailWidgetProps<AdminProduct>) => {
  const { data, isLoading } = useQuery<{ count: number }>({
    queryFn: () => sdk.client.fetch(`/admin/products/${product.id}/wishlist`),
    queryKey: ["products", product.id, "wishlist"],
  })

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Wishlist</Heading>
      </div>
      <Text className="px-6 py-4">
        {isLoading
          ? "Loading..."
          : `This product is in ${data?.count ?? 0} wishlist(s).`}
      </Text>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.before",
})

export default ProductWishlistWidget
```

Note: Check if `backend/src/admin/lib/sdk.ts` already exists (it should from the review module). If not, create it.

**Step 4: Commit**

```bash
git add backend/src/modules/wishlist/service.ts backend/src/api/admin/products/ backend/src/admin/widgets/product-wishlist-widget.tsx
git commit -m "feat: add admin wishlist count widget for product pages

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 14: End-to-End Verification

**Step 1: Full flow test — authenticated user**

1. Start backend and storefront
2. Log in as a test customer
3. Browse products, click heart on product card → should show notification "Added to wishlist"
4. Visit PDP, click heart → should show filled heart
5. Navigate to `/account/wishlist` → should see wishlisted items
6. Click "Add to cart" on a wishlist item → should add to cart, item stays in wishlist
7. Click remove on a wishlist item → should remove with notification
8. Create a second named wishlist → should appear as a tab
9. Share a wishlist → should get a token/link
10. Open shared link in incognito → should show read-only view

**Step 2: Full flow test — guest user**

1. Open storefront in incognito (logged out)
2. Click heart on product card → should silently create guest wishlist
3. Check cookies: `_medusa_wishlist_id` should exist
4. Add another item → should add to same guest wishlist
5. Log in → `transferWishlist()` should fire
6. Navigate to `/account/wishlist` → should see previously saved items

**Step 3: Edge cases to verify**

- Adding same variant twice → should show "already in wishlist" error
- Deleting a wishlist with items → should cascade soft-delete
- Expired share token → should show friendly error message
- Non-existent wishlist ID → 404
- No variants on a product → heart button should not crash

**Step 4: Update TODO.md**

Mark wishlist items as completed, add any discovered follow-up tasks.

**Step 5: Final commit**

```bash
git add TODO.md
git commit -m "docs: update TODO with completed wishlist items

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Summary

| Task | Files | Description |
|------|-------|-------------|
| 1 | 4 create | Wishlist module — models, service, migration |
| 2 | 3 create | Module links — customer, sales channel, product variant |
| 3 | 10 create | Workflow steps — validation + mutation with compensation |
| 4 | 6 create | Workflows — create, add item, delete item, delete, update, transfer |
| 5 | 8 create, 1 modify | Customer API routes + middleware |
| 6 | 7 create, 1 modify | Guest + shared API routes |
| 7 | 3 modify | Cookie, constants, types |
| 8 | 1 create, 1 modify | Server actions + auth integration |
| 9 | 1 create | Heart button component |
| 10 | 2 modify | Product card + PDP integration |
| 11 | 2 create, 1 modify | Account wishlist page + tab |
| 12 | 1 create | Shared wishlist page |
| 13 | 3 create/modify | Admin widget |
| 14 | verification | E2E testing + TODO update |
