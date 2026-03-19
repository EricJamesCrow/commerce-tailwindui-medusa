# Review Phase 2: Admin Responses + Review Images — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add admin response CRUD and customer image uploads to the product reviews system.

**Architecture:** Two new data models (`ReviewResponse`, `ReviewImage`) added to the existing `productReview` module. Three new response workflows (create, update, delete). Image uploads via Medusa's `uploadFilesWorkflow` through a dedicated store endpoint with multer. Storefront extended with inline thumbnails, lightbox, and admin response display.

**Tech Stack:** Medusa v2 (custom module, workflows, API routes), multer (file uploads), Headless UI (lightbox dialog), Next.js 16 Server Actions.

**Design Doc:** `docs/plans/2026-02-22-review-phase2-design.md`

---

## Task 1: Create ReviewResponse and ReviewImage Data Models

**Files:**
- Create: `backend/src/modules/product-review/models/review-response.ts`
- Create: `backend/src/modules/product-review/models/review-image.ts`
- Modify: `backend/src/modules/product-review/models/review.ts`

**Step 1: Create the ReviewResponse model**

```typescript
// backend/src/modules/product-review/models/review-response.ts
import { model } from "@medusajs/framework/utils"
import Review from "./review"

const ReviewResponse = model.define("review_response", {
  id: model.id({ prefix: "prr" }).primaryKey(),
  content: model.text(),
  review: model.belongsTo(() => Review, {
    mappedBy: "response",
  }),
})

export default ReviewResponse
```

**Step 2: Create the ReviewImage model**

```typescript
// backend/src/modules/product-review/models/review-image.ts
import { model } from "@medusajs/framework/utils"
import Review from "./review"

const ReviewImage = model.define("review_image", {
  id: model.id({ prefix: "prev_img" }).primaryKey(),
  url: model.text(),
  sort_order: model.number().default(0),
  review: model.belongsTo(() => Review, {
    mappedBy: "images",
  }),
})

export default ReviewImage
```

**Step 3: Add relationships to the existing Review model**

Modify `backend/src/modules/product-review/models/review.ts`. Add imports for the new models and add `response` (hasOne, nullable) and `images` (hasMany) relationships.

Current model (lines 1-21):
```typescript
import { model } from "@medusajs/framework/utils"

const Review = model.define("review", {
  id: model.id().primaryKey(),
  title: model.text().nullable(),
  content: model.text(),
  rating: model.float(),
  first_name: model.text(),
  last_name: model.text(),
  status: model.enum(["pending", "approved", "flagged"]).default("pending"),
  product_id: model.text().index("IDX_REVIEW_PRODUCT_ID"),
  customer_id: model.text().nullable(),
})
```

Modified model — add two lines before the closing `})`:
```typescript
import { model } from "@medusajs/framework/utils"
import ReviewResponse from "./review-response"
import ReviewImage from "./review-image"

const Review = model.define("review", {
  id: model.id().primaryKey(),
  title: model.text().nullable(),
  content: model.text(),
  rating: model.float(),
  first_name: model.text(),
  last_name: model.text(),
  status: model.enum(["pending", "approved", "flagged"]).default("pending"),
  product_id: model.text().index("IDX_REVIEW_PRODUCT_ID"),
  customer_id: model.text().nullable(),
  response: model.hasOne(() => ReviewResponse, { nullable: true }).nullable(),
  images: model.hasMany(() => ReviewImage),
})
.checks([
  {
    name: "rating_range",
    expression: (columns) => `${columns.rating} >= 1 AND ${columns.rating} <= 5`,
  },
])

export default Review
```

**Step 4: Commit**

```bash
git add backend/src/modules/product-review/models/review-response.ts backend/src/modules/product-review/models/review-image.ts backend/src/modules/product-review/models/review.ts
git commit -m "feat: add ReviewResponse and ReviewImage data models"
```

---

## Task 2: Register New Models in Service

**Files:**
- Modify: `backend/src/modules/product-review/service.ts`

**Step 1: Import and register new models**

Add imports for `ReviewResponse` and `ReviewImage`, and pass them to `MedusaService()`. This auto-generates CRUD methods: `createReviewResponses`, `updateReviewResponses`, `deleteReviewResponses`, `softDeleteReviewResponses`, `listReviewResponses`, `createReviewImages`, `deleteReviewImages`, `softDeleteReviewImages`, `listReviewImages`.

At the top of `backend/src/modules/product-review/service.ts`, add:
```typescript
import ReviewResponse from "./models/review-response"
import ReviewImage from "./models/review-image"
```

Modify the `MedusaService` call to include the new models:
```typescript
class ProductReviewModuleService extends MedusaService({
  Review,
  ReviewStats,
  ReviewResponse,
  ReviewImage,
}) {
```

No other changes to the service file — the existing custom methods remain unchanged.

**Step 2: Commit**

```bash
git add backend/src/modules/product-review/service.ts
git commit -m "feat: register ReviewResponse and ReviewImage in module service"
```

---

## Task 3: Generate and Run Migration

**Step 1: Generate migration**

Run from the `backend/` directory:

```bash
cd backend && bunx medusa db:generate productReview
```

This creates a new migration file in `backend/src/modules/product-review/migrations/` that adds the `review_response` and `review_image` tables and the new foreign key columns on `review`.

**Step 2: Run migration**

```bash
cd backend && bunx medusa db:migrate
```

**Step 3: Verify tables exist**

```bash
psql medusa_db -c "\dt review_response" && psql medusa_db -c "\dt review_image"
```

Expected: Both tables listed.

**Step 4: Commit the generated migration file**

```bash
git add backend/src/modules/product-review/migrations/
git commit -m "feat: add migration for review_response and review_image tables"
```

---

## Task 4: Create Response Workflow Steps

**Files:**
- Create: `backend/src/workflows/steps/create-review-response.ts`
- Create: `backend/src/workflows/steps/update-review-response.ts`
- Create: `backend/src/workflows/steps/delete-review-response.ts`

**Step 1: Create the create-review-response step**

```typescript
// backend/src/workflows/steps/create-review-response.ts
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { PRODUCT_REVIEW_MODULE } from "../../modules/product-review"
import type ProductReviewModuleService from "../../modules/product-review/service"

export type CreateReviewResponseStepInput = {
  review_id: string
  content: string
}

export const createReviewResponseStep = createStep(
  "create-review-response",
  async (input: CreateReviewResponseStepInput, { container }) => {
    const service: ProductReviewModuleService = container.resolve(
      PRODUCT_REVIEW_MODULE
    )

    const response = await service.createReviewResponses({
      content: input.content,
      review_id: input.review_id,
    })

    return new StepResponse(response, response.id)
  },
  async (responseId, { container }) => {
    if (!responseId) return

    const service: ProductReviewModuleService = container.resolve(
      PRODUCT_REVIEW_MODULE
    )

    await service.softDeleteReviewResponses(responseId)
  }
)
```

**Step 2: Create the update-review-response step**

```typescript
// backend/src/workflows/steps/update-review-response.ts
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { PRODUCT_REVIEW_MODULE } from "../../modules/product-review"
import type ProductReviewModuleService from "../../modules/product-review/service"

export type UpdateReviewResponseStepInput = {
  id: string
  content: string
}

export const updateReviewResponseStep = createStep(
  "update-review-response",
  async (input: UpdateReviewResponseStepInput, { container }) => {
    const service: ProductReviewModuleService = container.resolve(
      PRODUCT_REVIEW_MODULE
    )

    // Save original for compensation
    const original = await service.retrieveReviewResponse(input.id)

    const updated = await service.updateReviewResponses({
      id: input.id,
      content: input.content,
    })

    return new StepResponse(updated, { id: original.id, content: original.content })
  },
  async (originalData, { container }) => {
    if (!originalData) return

    const service: ProductReviewModuleService = container.resolve(
      PRODUCT_REVIEW_MODULE
    )

    await service.updateReviewResponses({
      id: originalData.id,
      content: originalData.content,
    })
  }
)
```

**Step 3: Create the delete-review-response step**

```typescript
// backend/src/workflows/steps/delete-review-response.ts
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { PRODUCT_REVIEW_MODULE } from "../../modules/product-review"
import type ProductReviewModuleService from "../../modules/product-review/service"

export const deleteReviewResponseStep = createStep(
  "delete-review-response",
  async (id: string, { container }) => {
    const service: ProductReviewModuleService = container.resolve(
      PRODUCT_REVIEW_MODULE
    )

    // Save for compensation
    const original = await service.retrieveReviewResponse(id)

    await service.softDeleteReviewResponses(id)

    return new StepResponse(undefined, original)
  },
  async (original, { container }) => {
    if (!original) return

    const service: ProductReviewModuleService = container.resolve(
      PRODUCT_REVIEW_MODULE
    )

    await service.restoreReviewResponses(original.id)
  }
)
```

**Step 4: Commit**

```bash
git add backend/src/workflows/steps/create-review-response.ts backend/src/workflows/steps/update-review-response.ts backend/src/workflows/steps/delete-review-response.ts
git commit -m "feat: add review response workflow steps with compensation"
```

---

## Task 5: Create Response Workflows

**Files:**
- Create: `backend/src/workflows/create-review-response.ts`
- Create: `backend/src/workflows/update-review-response.ts`
- Create: `backend/src/workflows/delete-review-response.ts`

**Step 1: Create the create-review-response workflow**

```typescript
// backend/src/workflows/create-review-response.ts
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { emitEventStep } from "@medusajs/medusa/core-flows"
import {
  createReviewResponseStep,
  type CreateReviewResponseStepInput,
} from "./steps/create-review-response"

export const createReviewResponseWorkflow = createWorkflow(
  "create-review-response",
  function (input: CreateReviewResponseStepInput) {
    const response = createReviewResponseStep(input)

    const eventData = transform({ response }, (data) => ({
      eventName: "product_review_response.created" as const,
      data: { id: data.response.id },
    }))

    emitEventStep(eventData)

    return new WorkflowResponse({ response })
  }
)
```

**Step 2: Create the update-review-response workflow**

```typescript
// backend/src/workflows/update-review-response.ts
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { emitEventStep } from "@medusajs/medusa/core-flows"
import {
  updateReviewResponseStep,
  type UpdateReviewResponseStepInput,
} from "./steps/update-review-response"

export const updateReviewResponseWorkflow = createWorkflow(
  "update-review-response",
  function (input: UpdateReviewResponseStepInput) {
    const response = updateReviewResponseStep(input)

    const eventData = transform({ response }, (data) => ({
      eventName: "product_review_response.updated" as const,
      data: { id: data.response.id },
    }))

    emitEventStep(eventData)

    return new WorkflowResponse({ response })
  }
)
```

**Step 3: Create the delete-review-response workflow**

```typescript
// backend/src/workflows/delete-review-response.ts
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { emitEventStep } from "@medusajs/medusa/core-flows"
import { deleteReviewResponseStep } from "./steps/delete-review-response"

type DeleteReviewResponseInput = {
  id: string
}

export const deleteReviewResponseWorkflow = createWorkflow(
  "delete-review-response",
  function (input: DeleteReviewResponseInput) {
    deleteReviewResponseStep(input.id)

    const eventData = transform({ input }, (data) => ({
      eventName: "product_review_response.deleted" as const,
      data: { id: data.input.id },
    }))

    emitEventStep(eventData)

    return new WorkflowResponse({ success: true })
  }
)
```

**Step 4: Commit**

```bash
git add backend/src/workflows/create-review-response.ts backend/src/workflows/update-review-response.ts backend/src/workflows/delete-review-response.ts
git commit -m "feat: add review response CRUD workflows"
```

---

## Task 6: Create Review Images Workflow Step

**Files:**
- Create: `backend/src/workflows/steps/create-review-images.ts`

**Step 1: Create the step**

```typescript
// backend/src/workflows/steps/create-review-images.ts
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { PRODUCT_REVIEW_MODULE } from "../../modules/product-review"
import type ProductReviewModuleService from "../../modules/product-review/service"

export type CreateReviewImagesStepInput = {
  review_id: string
  images: { url: string; sort_order: number }[]
}

const MAX_REVIEW_IMAGES = 3

export const createReviewImagesStep = createStep(
  "create-review-images",
  async (input: CreateReviewImagesStepInput, { container }) => {
    if (input.images.length > MAX_REVIEW_IMAGES) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Maximum ${MAX_REVIEW_IMAGES} images per review`
      )
    }

    if (input.images.length === 0) {
      return new StepResponse([], [])
    }

    const service: ProductReviewModuleService = container.resolve(
      PRODUCT_REVIEW_MODULE
    )

    const created = await service.createReviewImages(
      input.images.map((img) => ({
        url: img.url,
        sort_order: img.sort_order,
        review_id: input.review_id,
      }))
    )

    const ids = Array.isArray(created) ? created.map((c) => c.id) : [created.id]

    return new StepResponse(created, ids)
  },
  async (imageIds, { container }) => {
    if (!imageIds || imageIds.length === 0) return

    const service: ProductReviewModuleService = container.resolve(
      PRODUCT_REVIEW_MODULE
    )

    await service.softDeleteReviewImages(imageIds)
  }
)
```

**Step 2: Commit**

```bash
git add backend/src/workflows/steps/create-review-images.ts
git commit -m "feat: add create review images workflow step with validation"
```

---

## Task 7: Modify Create Review Workflow for Images

**Files:**
- Modify: `backend/src/workflows/create-review.ts`
- Modify: `backend/src/workflows/steps/create-review.ts`

**Step 1: Extend CreateReviewStepInput to include images**

In `backend/src/workflows/steps/create-review.ts`, add `images` to the input type:

```typescript
export type CreateReviewStepInput = {
  title?: string
  content: string
  rating: number
  product_id: string
  customer_id?: string
  first_name: string
  last_name: string
  status?: "pending" | "approved" | "flagged"
  images?: { url: string; sort_order: number }[]
}
```

The step itself doesn't change — it still creates just the review record. Images are handled by a separate step.

**Step 2: Add image creation step to the workflow**

Modify `backend/src/workflows/create-review.ts` to conditionally create images after the review:

```typescript
import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { createReviewStep, type CreateReviewStepInput } from "./steps/create-review"
import { createReviewImagesStep } from "./steps/create-review-images"
import { refreshReviewStatsStep } from "./steps/refresh-review-stats"
import { useQueryGraphStep, emitEventStep } from "@medusajs/medusa/core-flows"

export const createReviewWorkflow = createWorkflow(
  "create-review",
  function (input: CreateReviewStepInput) {
    useQueryGraphStep({
      entity: "product",
      fields: ["id"],
      filters: {
        id: input.product_id,
      },
      options: {
        throwIfKeyNotFound: true,
      },
    })

    const review = createReviewStep(input)

    const imagesInput = transform({ review, input }, (data) => ({
      review_id: data.review.id,
      images: data.input.images || [],
    }))

    when({ imagesInput }, (data) => data.imagesInput.images.length > 0).then(
      function () {
        createReviewImagesStep(imagesInput)
      }
    )

    const statsInput = transform({ input }, (data) => ({
      product_id: data.input.product_id,
    }))

    refreshReviewStatsStep(statsInput)

    const eventData = transform({ review, input }, (data) => ({
      eventName: "product_review.created" as const,
      data: {
        id: data.review.id,
        product_id: data.input.product_id,
      },
    }))

    emitEventStep(eventData)

    return new WorkflowResponse({
      review,
    })
  }
)
```

**Step 3: Commit**

```bash
git add backend/src/workflows/create-review.ts backend/src/workflows/steps/create-review.ts
git commit -m "feat: add image creation to review workflow"
```

---

## Task 8: Admin Response API Route

**Files:**
- Create: `backend/src/api/admin/reviews/[id]/response/route.ts`

Medusa convention: use POST for both create and update mutations. We'll check if a response exists and upsert accordingly.

**Step 1: Create the route file**

```typescript
// backend/src/api/admin/reviews/[id]/response/route.ts
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { createReviewResponseWorkflow } from "../../../../../workflows/create-review-response"
import { updateReviewResponseWorkflow } from "../../../../../workflows/update-review-response"
import { deleteReviewResponseWorkflow } from "../../../../../workflows/delete-review-response"
import { PRODUCT_REVIEW_MODULE } from "../../../../../modules/product-review"
import type ProductReviewModuleService from "../../../../../modules/product-review/service"

export const PostAdminReviewResponseSchema = z.object({
  content: z.string().min(1),
})

type PostAdminReviewResponseReq = z.infer<typeof PostAdminReviewResponseSchema>

export const POST = async (
  req: AuthenticatedMedusaRequest<PostAdminReviewResponseReq>,
  res: MedusaResponse
) => {
  const reviewId = req.params.id
  const { content } = req.validatedBody

  const service: ProductReviewModuleService = req.scope.resolve(
    PRODUCT_REVIEW_MODULE
  )

  // Check if response already exists for this review
  const existing = await service.listReviewResponses({ review_id: reviewId })

  if (existing[0]) {
    // Update existing response
    const { result } = await updateReviewResponseWorkflow(req.scope).run({
      input: {
        id: existing[0].id,
        content,
      },
    })
    return res.json({ product_review_response: result.response })
  }

  // Create new response
  const { result } = await createReviewResponseWorkflow(req.scope).run({
    input: {
      review_id: reviewId,
      content,
    },
  })

  res.json({ product_review_response: result.response })
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const reviewId = req.params.id

  const service: ProductReviewModuleService = req.scope.resolve(
    PRODUCT_REVIEW_MODULE
  )

  const existing = await service.listReviewResponses({ review_id: reviewId })

  if (!existing[0]) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No response found for this review"
    )
  }

  await deleteReviewResponseWorkflow(req.scope).run({
    input: { id: existing[0].id },
  })

  res.json({ message: "Response deleted" })
}
```

**Step 2: Commit**

```bash
git add backend/src/api/admin/reviews/[id]/response/route.ts
git commit -m "feat: add admin review response API route (POST/DELETE)"
```

---

## Task 9: Store Upload API Route

**Files:**
- Create: `backend/src/api/store/reviews/uploads/route.ts`

**Step 1: Create the upload route**

```typescript
// backend/src/api/store/reviews/uploads/route.ts
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { uploadFilesWorkflow } from "@medusajs/medusa/core-flows"
import { MedusaError } from "@medusajs/framework/utils"

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const input = req.files as Express.Multer.File[]

  if (!input?.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "No files were uploaded"
    )
  }

  const { result } = await uploadFilesWorkflow(req.scope).run({
    input: {
      files: input.map((f) => ({
        filename: f.originalname,
        mimeType: f.mimetype,
        content: f.buffer.toString("binary"),
        access: "public" as const,
      })),
    },
  })

  res.json({ files: result })
}
```

**Step 2: Commit**

```bash
git add backend/src/api/store/reviews/uploads/route.ts
git commit -m "feat: add store review image upload route"
```

---

## Task 10: Modify Store Review Routes

**Files:**
- Modify: `backend/src/api/store/reviews/route.ts`
- Modify: `backend/src/api/store/products/[id]/reviews/route.ts`

**Step 1: Add images to the create review schema**

In `backend/src/api/store/reviews/route.ts`, add `images` to the Zod schema:

```typescript
export const PostStoreReviewSchema = z.object({
  title: z.string().optional(),
  content: z.string(),
  rating: z.preprocess(
    (val) => {
      if (val && typeof val === "string") {
        return parseInt(val)
      }
      return val
    },
    z.number().min(1).max(5)
  ),
  product_id: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  images: z.array(z.object({
    url: z.string().url(),
    sort_order: z.number().int().min(0),
  })).max(3).optional(),
})
```

No changes to the POST handler — the `images` field passes through via `...input` spread and is handled by the workflow.

**Step 2: Add images and response to GET defaults**

This is done in `backend/src/api/middlewares.ts` (Task 11). The route file `backend/src/api/store/products/[id]/reviews/route.ts` already uses `...req.queryConfig` so it will automatically include the new fields once the middleware defaults are updated. No changes to the route file itself.

**Step 3: Commit**

```bash
git add backend/src/api/store/reviews/route.ts
git commit -m "feat: accept images array in create review schema"
```

---

## Task 11: Register All New Middlewares

**Files:**
- Modify: `backend/src/api/middlewares.ts`

**Step 1: Add multer and new middleware entries**

Add the following new middleware entries to `backend/src/api/middlewares.ts`:

1. **Multer middleware for uploads** — needs `multer` import and file validation
2. **Body validation for admin response** — `PostAdminReviewResponseSchema`
3. **Auth for upload route** — customer authentication
4. **Update GET defaults** — add `images.*` and `response.*` to store reviews list defaults

Install multer types (multer itself ships with `@medusajs/framework`):

```bash
cd backend && bun add -D @types/multer
```

Updated `backend/src/api/middlewares.ts`:

```typescript
import {
  defineMiddlewares,
  authenticate,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import multer from "multer"
import { PostStoreReviewSchema } from "./store/reviews/route"
import { PostAdminUpdateReviewsStatusSchema } from "./admin/reviews/status/route"
import { PostAdminReviewResponseSchema } from "./admin/reviews/[id]/response/route"
import { GetAdminReviewsSchema } from "./admin/reviews/route"
import { GetStoreReviewsSchema } from "./store/products/[id]/reviews/route"
import {
  WishlistNameSchema,
  PostCreateWishlistItemSchema,
} from "./store/customers/me/wishlists/validators"
import {
  PostGuestCreateWishlistItemSchema,
  PostImportWishlistSchema,
} from "./store/wishlists/validators"

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

const reviewImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 3,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error("Only JPEG, PNG, and WebP images are allowed"))
    }
  },
})

export default defineMiddlewares({
  routes: [
    // --- Reviews: Store ---
    {
      method: ["POST"],
      matcher: "/store/reviews",
      middlewares: [
        authenticate("customer", ["session", "bearer"]),
        validateAndTransformBody(PostStoreReviewSchema),
      ],
    },
    {
      matcher: "/store/products/:id/reviews",
      method: ["GET"],
      middlewares: [
        validateAndTransformQuery(GetStoreReviewsSchema, {
          isList: true,
          defaults: [
            "id",
            "rating",
            "title",
            "first_name",
            "last_name",
            "content",
            "created_at",
            "images.*",
            "response.*",
          ],
        }),
      ],
    },
    // --- Reviews: Store Uploads ---
    {
      matcher: "/store/reviews/uploads",
      method: ["POST"],
      middlewares: [
        authenticate("customer", ["session", "bearer"]),
        reviewImageUpload.array("files"),
      ],
    },
    // --- Reviews: Admin ---
    {
      matcher: "/admin/reviews",
      method: ["GET"],
      middlewares: [
        validateAndTransformQuery(GetAdminReviewsSchema, {
          isList: true,
          defaults: [
            "id",
            "title",
            "content",
            "rating",
            "product_id",
            "customer_id",
            "status",
            "created_at",
            "updated_at",
            "product.*",
            "response.*",
          ],
        }),
      ],
    },
    {
      matcher: "/admin/reviews/status",
      method: ["POST"],
      middlewares: [
        validateAndTransformBody(PostAdminUpdateReviewsStatusSchema),
      ],
    },
    {
      matcher: "/admin/reviews/:id/response",
      method: ["POST"],
      middlewares: [
        validateAndTransformBody(PostAdminReviewResponseSchema),
      ],
    },
    // --- Wishlists (unchanged) ---
    {
      matcher: "/store/customers/me/wishlists*",
      middlewares: [
        authenticate("customer", ["session", "bearer"]),
      ],
    },
    {
      matcher: "/store/customers/me/wishlists",
      method: ["POST"],
      middlewares: [
        validateAndTransformBody(WishlistNameSchema),
      ],
    },
    {
      matcher: "/store/customers/me/wishlists/:id",
      method: ["PUT"],
      middlewares: [
        validateAndTransformBody(WishlistNameSchema),
      ],
    },
    {
      matcher: "/store/customers/me/wishlists/:id/items",
      method: ["POST"],
      middlewares: [
        validateAndTransformBody(PostCreateWishlistItemSchema),
      ],
    },
    {
      matcher: "/store/wishlists/:id/items",
      method: ["POST"],
      middlewares: [
        validateAndTransformBody(PostGuestCreateWishlistItemSchema),
      ],
    },
    {
      matcher: "/store/wishlists/import",
      method: ["POST"],
      middlewares: [
        authenticate("customer", ["session", "bearer"]),
        validateAndTransformBody(PostImportWishlistSchema),
      ],
    },
  ],
})
```

**Step 2: Commit**

```bash
git add backend/src/api/middlewares.ts backend/package.json
git commit -m "feat: register middlewares for review uploads and admin responses"
```

---

## Task 12: Build Validation — Backend

**Step 1: Run the backend build**

```bash
cd backend && bun run build
```

Fix any TypeScript errors before proceeding. Common issues:
- Import path typos
- Missing type annotations on new models
- `review_id` vs `review` property name mismatches in MedusaService methods

**Step 2: Start dev server and test routes with curl**

```bash
cd backend && bun run dev
```

Test admin response creation (use admin session cookie):
```bash
# Get a review ID first
curl -s http://localhost:9000/admin/reviews?limit=1 -H "Cookie: connect.sid=YOUR_SESSION" | jq '.reviews[0].id'

# Create response
curl -X POST http://localhost:9000/admin/reviews/REVIEW_ID/response \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION" \
  -d '{"content":"Thank you for your review!"}'
```

Test store reviews include response and images:
```bash
curl -s "http://localhost:9000/store/products/PRODUCT_ID/reviews?limit=5" \
  -H "x-publishable-api-key: YOUR_KEY" | jq '.reviews[0] | {response, images}'
```

---

## Task 13: Storefront Types — Extend Review Type

**Files:**
- Modify: `storefront/lib/types.ts`

**Step 1: Add images and response to Review type**

In `storefront/lib/types.ts`, update the `Review` type (around line 137):

```typescript
export type Review = {
  id: string;
  title: string;
  content: string;
  rating: number;
  first_name: string;
  last_name: string;
  created_at: string;
  images: ReviewImage[];
  response: ReviewResponse | null;
};

export type ReviewImage = {
  id: string;
  url: string;
  sort_order: number;
};

export type ReviewResponse = {
  id: string;
  content: string;
  created_at: string;
};
```

**Step 2: Commit**

```bash
git add storefront/lib/types.ts
git commit -m "feat: extend Review type with images and response"
```

---

## Task 14: Storefront Server Actions — Upload and Modified Fetch

**Files:**
- Modify: `storefront/lib/medusa/reviews.ts`

**Step 1: Add uploadReviewImages function**

Add a new function to upload images to the backend:

```typescript
export async function uploadReviewImages(
  files: File[]
): Promise<{ id: string; url: string }[]> {
  const headers = await getAuthHeaders();

  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  const response = await sdk.client.fetch<{
    files: { id: string; url: string }[];
  }>("/store/reviews/uploads", {
    method: "POST",
    headers,
    body: formData,
  });

  return response.files;
}
```

**Step 2: Modify addProductReview to accept images**

Update the `addProductReview` function to accept image URLs as an additional parameter. Change the function signature to accept `images` from the form data:

After the `rating` extraction, add image URL parsing:

```typescript
// Parse image URLs from hidden form field (JSON-encoded array)
const imagesJson = formData.get("images") as string | null;
const images: { url: string; sort_order: number }[] = imagesJson
  ? JSON.parse(imagesJson)
  : [];
```

And add `images` to the fetch body:

```typescript
body: {
  product_id: productId,
  title,
  content,
  rating,
  first_name: customer.first_name || "Customer",
  last_name: customer.last_name || "",
  ...(images.length > 0 ? { images } : {}),
},
```

**Step 3: Commit**

```bash
git add storefront/lib/medusa/reviews.ts
git commit -m "feat: add image upload and pass images in review submission"
```

---

## Task 15: ReviewForm — Add Image Upload UI

**Files:**
- Modify: `storefront/components/reviews/ReviewForm.tsx`

**Step 1: Add image state and upload logic**

Add to the component:
- `selectedFiles: File[]` state — files the user has selected (max 3)
- `isUploading: boolean` state — true while uploading to backend
- File input with `accept="image/jpeg,image/png,image/webp"`
- Thumbnail previews using `URL.createObjectURL`
- Remove button on each thumbnail
- On submit: upload files first, then include URLs in form data

Key additions inside `ReviewForm`:

```typescript
const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
const [isUploading, setIsUploading] = useState(false);

const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(e.target.files || []);
  setSelectedFiles((prev) => [...prev, ...files].slice(0, 3));
  e.target.value = ""; // reset input
};

const removeFile = (index: number) => {
  setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
};
```

Wrap the form `action` with a custom handler that uploads images first:

```typescript
const handleSubmit = async (formData: FormData) => {
  if (selectedFiles.length > 0) {
    setIsUploading(true);
    try {
      const uploaded = await uploadReviewImages(selectedFiles);
      const images = uploaded.map((f, i) => ({
        url: f.url,
        sort_order: i,
      }));
      formData.set("images", JSON.stringify(images));
    } catch {
      // If upload fails, don't submit the review
      setIsUploading(false);
      return;
    }
    setIsUploading(false);
  }
  formAction(formData);
};
```

Change `<form action={formAction}>` to `<form action={handleSubmit}>`.

Add the image upload section in the form after the textarea:

```tsx
<div>
  <label className="block text-sm font-medium text-gray-700">
    Photos <span className="text-gray-400">(optional, max 3)</span>
  </label>
  <div className="mt-2 flex gap-2">
    {selectedFiles.map((file, i) => (
      <div key={i} className="relative">
        <img
          src={URL.createObjectURL(file)}
          alt=""
          className="size-16 rounded-md object-cover"
        />
        <button
          type="button"
          onClick={() => removeFile(i)}
          className="absolute -top-1 -right-1 rounded-full bg-gray-900 p-0.5 text-white"
        >
          <XMarkIcon className="size-3" />
        </button>
      </div>
    ))}
    {selectedFiles.length < 3 && (
      <label className="flex size-16 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-gray-300 hover:border-gray-400">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />
        <span className="text-2xl text-gray-400">+</span>
      </label>
    )}
  </div>
</div>
```

Update the submit button to show upload state:

```tsx
{isUploading ? "Uploading images..." : isPending ? "Submitting..." : "Submit review"}
```

And disable during upload:

```typescript
const isDisabled = isPending || isUploading || rating === 0;
```

**Step 2: Add import for uploadReviewImages**

```typescript
import { addProductReview, uploadReviewImages, type ReviewActionResult } from "lib/medusa/reviews";
```

**Step 3: Commit**

```bash
git add storefront/components/reviews/ReviewForm.tsx
git commit -m "feat: add image upload UI to review form"
```

---

## Task 16: ReviewList — Display Images and Admin Responses

**Files:**
- Modify: `storefront/components/reviews/ReviewList.tsx`
- Create: `storefront/components/reviews/ReviewImageLightbox.tsx`

**Step 1: Create the lightbox component**

```typescript
// storefront/components/reviews/ReviewImageLightbox.tsx
"use client";

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
} from "@headlessui/react";
import {
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import Image from "next/image";
import { useState } from "react";

export function ReviewImageLightbox({
  images,
  initialIndex,
  open,
  onClose,
}: {
  images: { url: string }[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const image = images[index];

  if (!image) return null;

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-black/80" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="relative max-h-[90vh] max-w-3xl">
          <button
            type="button"
            onClick={onClose}
            className="absolute -top-10 right-0 text-white hover:text-gray-300"
          >
            <XMarkIcon className="size-8" />
          </button>

          <Image
            src={image.url}
            alt=""
            width={800}
            height={600}
            className="max-h-[80vh] rounded-lg object-contain"
          />

          {images.length > 1 && (
            <div className="absolute inset-y-0 flex w-full items-center justify-between px-2">
              <button
                type="button"
                onClick={() => setIndex((i) => (i > 0 ? i - 1 : images.length - 1))}
                className="rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
              >
                <ChevronLeftIcon className="size-6" />
              </button>
              <button
                type="button"
                onClick={() => setIndex((i) => (i < images.length - 1 ? i + 1 : 0))}
                className="rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
              >
                <ChevronRightIcon className="size-6" />
              </button>
            </div>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
```

**Step 2: Update ReviewList to display images and admin responses**

Modify `storefront/components/reviews/ReviewList.tsx`:

```typescript
"use client";

import { StarIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";
import type { Review } from "lib/types";
import { DEFAULT_LOCALE } from "lib/constants";
import Image from "next/image";
import { useState } from "react";
import { ReviewImageLightbox } from "./ReviewImageLightbox";

export function ReviewList({ reviews }: { reviews: Review[] }) {
  const [lightbox, setLightbox] = useState<{
    images: { url: string }[];
    index: number;
  } | null>(null);

  if (reviews.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No reviews yet. Be the first to share your thoughts!
      </p>
    );
  }

  return (
    <>
      <div className="flow-root">
        <div className="-my-12 divide-y divide-gray-200">
          {reviews.map((review) => {
            const sortedImages = [...(review.images || [])].sort(
              (a, b) => a.sort_order - b.sort_order
            );

            return (
              <div key={review.id} className="py-12">
                <div className="flex items-center">
                  <div className="flex size-12 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-600">
                    {review.first_name.charAt(0)}
                    {review.last_name.charAt(0)}
                  </div>
                  <div className="ml-4">
                    <h4 className="text-sm font-bold text-gray-900">
                      {review.first_name} {review.last_name.charAt(0)}.
                    </h4>
                    <div className="mt-1 flex items-center">
                      {[0, 1, 2, 3, 4].map((rating) => (
                        <StarIcon
                          key={rating}
                          aria-hidden="true"
                          className={clsx(
                            review.rating > rating
                              ? "text-yellow-400"
                              : "text-gray-300",
                            "size-5 shrink-0",
                          )}
                        />
                      ))}
                    </div>
                    <p className="sr-only">{review.rating} out of 5 stars</p>
                  </div>
                </div>

                {review.title && (
                  <h5 className="mt-4 text-sm font-semibold text-gray-900">
                    {review.title}
                  </h5>
                )}

                <p className="mt-2 text-sm text-gray-600">{review.content}</p>

                {/* Review Images */}
                {sortedImages.length > 0 && (
                  <div className="mt-3 flex gap-2">
                    {sortedImages.map((img, i) => (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() =>
                          setLightbox({ images: sortedImages, index: i })
                        }
                        className="overflow-hidden rounded-md"
                      >
                        <Image
                          src={img.url}
                          alt=""
                          width={64}
                          height={64}
                          className="size-16 object-cover transition hover:opacity-75"
                        />
                      </button>
                    ))}
                  </div>
                )}

                <time
                  dateTime={review.created_at}
                  className="mt-2 block text-xs text-gray-400"
                >
                  {new Date(review.created_at).toLocaleDateString(
                    DEFAULT_LOCALE,
                    {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    },
                  )}
                </time>

                {/* Admin Response */}
                {review.response && (
                  <div className="mt-4 rounded-lg bg-gray-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Store response
                    </p>
                    <p className="mt-1 text-sm text-gray-700">
                      {review.response.content}
                    </p>
                    <time
                      dateTime={review.response.created_at}
                      className="mt-1 block text-xs text-gray-400"
                    >
                      {new Date(
                        review.response.created_at,
                      ).toLocaleDateString(DEFAULT_LOCALE, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </time>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {lightbox && (
        <ReviewImageLightbox
          images={lightbox.images}
          initialIndex={lightbox.index}
          open={true}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );
}
```

**Step 3: Commit**

```bash
git add storefront/components/reviews/ReviewList.tsx storefront/components/reviews/ReviewImageLightbox.tsx
git commit -m "feat: display review images with lightbox and admin responses"
```

---

## Task 17: Admin UI — Response Management

**Files:**
- Modify: `backend/src/admin/routes/reviews/page.tsx`

**Step 1: Add response column and detail drawer**

Extend the admin reviews page with:
1. A "Response" column showing whether a response exists
2. A row-click action that opens a detail drawer
3. In the drawer: review content + a textarea to create/edit/delete the admin response

Add these elements to `backend/src/admin/routes/reviews/page.tsx`:

Add a new column after "status":
```typescript
columnHelper.accessor("response", {
  header: "Response",
  cell: ({ row }) => {
    return row.original.response ? (
      <StatusBadge color="green">Responded</StatusBadge>
    ) : (
      <StatusBadge color="grey">No response</StatusBadge>
    )
  },
}),
```

Add the `response` field to the Review type:
```typescript
type Review = {
  id: string
  title?: string
  content: string
  rating: number
  product_id: string
  customer_id?: string
  status: "pending" | "approved" | "flagged"
  created_at: Date
  updated_at: Date
  product?: HttpTypes.AdminProduct
  response?: {
    id: string
    content: string
    created_at: string
  } | null
}
```

Add a detail drawer component within the same file:

```typescript
const ReviewDetailDrawer = ({
  review,
  onClose,
  onResponseChange,
}: {
  review: Review | null
  onClose: () => void
  onResponseChange: () => void
}) => {
  const [responseContent, setResponseContent] = useState(
    review?.response?.content || ""
  )
  const [isSaving, setIsSaving] = useState(false)

  if (!review) return null

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await sdk.client.fetch(`/admin/reviews/${review.id}/response`, {
        method: "POST",
        body: { content: responseContent },
      })
      toast.success("Response saved")
      onResponseChange()
      onClose()
    } catch {
      toast.error("Failed to save response")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setIsSaving(true)
    try {
      await sdk.client.fetch(`/admin/reviews/${review.id}/response`, {
        method: "DELETE",
      })
      toast.success("Response deleted")
      onResponseChange()
      onClose()
    } catch {
      toast.error("Failed to delete response")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-xl">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <Heading level="h2">Review Detail</Heading>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-500">Rating</p>
            <p className="text-sm">{review.rating}/5</p>
          </div>
          {review.title && (
            <div>
              <p className="text-sm font-medium text-gray-500">Title</p>
              <p className="text-sm">{review.title}</p>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-500">Content</p>
            <p className="text-sm">{review.content}</p>
          </div>
          <hr />
          <div>
            <p className="text-sm font-medium text-gray-500">Admin Response</p>
            <textarea
              value={responseContent}
              onChange={(e) => setResponseContent(e.target.value)}
              rows={4}
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Write a response to this review..."
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={handleSave}
                disabled={isSaving || !responseContent.trim()}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {review.response ? "Update" : "Save"} Response
              </button>
              {review.response && (
                <button
                  onClick={handleDelete}
                  disabled={isSaving}
                  className="rounded-md bg-red-50 px-3 py-1.5 text-sm text-red-600 hover:bg-red-100 disabled:opacity-50"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

Add state and row click handler to `ReviewsPage`:
```typescript
const [selectedReview, setSelectedReview] = useState<Review | null>(null)
```

Pass `onRowClick` to the DataTable or add a clickable cell. Since `@medusajs/ui` DataTable may not support row click directly, add a "View" action column:

```typescript
columnHelper.display({
  id: "actions",
  cell: ({ row }) => (
    <button
      onClick={() => setSelectedReview(row.original)}
      className="text-sm text-blue-600 hover:underline"
    >
      View
    </button>
  ),
}),
```

And render the drawer in the return:
```tsx
{selectedReview && (
  <ReviewDetailDrawer
    review={selectedReview}
    onClose={() => setSelectedReview(null)}
    onResponseChange={refetch}
  />
)}
```

**Step 2: Commit**

```bash
git add backend/src/admin/routes/reviews/page.tsx
git commit -m "feat: add admin response management drawer to reviews page"
```

---

## Task 18: Build Validation — Full Stack

**Step 1: Build the backend**

```bash
cd backend && bun run build
```

Fix any errors.

**Step 2: Build the storefront**

```bash
cd storefront && bun run build
```

Fix any errors. Common issues:
- Next.js Image component needs the upload URL hostname in `next.config.ts` `remotePatterns`
- Missing imports in modified files

**Step 3: If using local File Module, add localhost upload path to next.config.ts**

The local File Module stores files at `http://localhost:9000/static/*`. This hostname (`localhost`) is already in `remotePatterns` in `next.config.ts`, so no change needed for development.

For production with S3, the S3 bucket hostname would need to be added.

**Step 4: Start both services and test end-to-end**

```bash
bun run dev  # starts both storefront + backend
```

Test flow:
1. Browse to a product page
2. Click "Write a review"
3. Select images, fill form, submit
4. Verify images appear in review list
5. Click image thumbnail to open lightbox
6. Go to admin → Reviews → Click "View" on a review
7. Write admin response, save
8. Verify response appears on storefront

---

## Task 19: Update TODO.md

**Files:**
- Modify: `TODO.md`

**Step 1: Mark Phase 2 items as complete**

```markdown
### Phase 2: Admin Responses & Review Images

- [x] `ProductReviewResponse` entity — admin replies to reviews (full CRUD)
- [x] `ProductReviewImage` entity — image upload endpoint for review photos
- [x] Display admin responses on storefront review list
```

**Step 2: Commit**

```bash
git add TODO.md
git commit -m "docs: mark review Phase 2 as complete in TODO"
```

---

## Summary of Files

### Created (9 files)
| File | Purpose |
|------|---------|
| `backend/src/modules/product-review/models/review-response.ts` | ReviewResponse data model |
| `backend/src/modules/product-review/models/review-image.ts` | ReviewImage data model |
| `backend/src/workflows/steps/create-review-response.ts` | Create response step |
| `backend/src/workflows/steps/update-review-response.ts` | Update response step |
| `backend/src/workflows/steps/delete-review-response.ts` | Delete response step |
| `backend/src/workflows/steps/create-review-images.ts` | Create images step |
| `backend/src/workflows/create-review-response.ts` | Create response workflow |
| `backend/src/workflows/update-review-response.ts` | Update response workflow |
| `backend/src/workflows/delete-review-response.ts` | Delete response workflow |
| `backend/src/api/admin/reviews/[id]/response/route.ts` | Admin response API route |
| `backend/src/api/store/reviews/uploads/route.ts` | Store image upload route |
| `storefront/components/reviews/ReviewImageLightbox.tsx` | Image lightbox component |

### Modified (8 files)
| File | Changes |
|------|---------|
| `backend/src/modules/product-review/models/review.ts` | Add response + images relationships |
| `backend/src/modules/product-review/service.ts` | Register new models |
| `backend/src/api/middlewares.ts` | Add multer, validation, auth for new routes |
| `backend/src/api/store/reviews/route.ts` | Add images to Zod schema |
| `backend/src/workflows/create-review.ts` | Add image creation step |
| `backend/src/workflows/steps/create-review.ts` | Add images to input type |
| `storefront/lib/types.ts` | Extend Review type |
| `storefront/lib/medusa/reviews.ts` | Add upload function, pass images |
| `storefront/components/reviews/ReviewForm.tsx` | Image upload UI |
| `storefront/components/reviews/ReviewList.tsx` | Display images + responses |
| `backend/src/admin/routes/reviews/page.tsx` | Response management drawer |
