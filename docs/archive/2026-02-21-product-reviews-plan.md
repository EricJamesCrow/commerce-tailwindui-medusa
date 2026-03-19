# Product Reviews Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add product reviews with 5-star ratings, verified purchase requirement, auto-publish with admin flagging, and Amazon-style summary bars — using the official Medusa tutorial for backend and TailwindPlus components for storefront UI.

**Architecture:** Medusa custom module (`productReview`) with Review data model, linked to Product via `product_id`. Store API routes for creating/listing reviews, admin routes for moderation. Next.js storefront fetches reviews via `sdk.client.fetch`, displays with TailwindPlus "With summary chart" component pattern, and submits via Server Action through a Headless UI Dialog modal.

**Tech Stack:** Medusa v2.13 custom module, Next.js 16, TailwindPlus components, Headless UI Dialog, `@heroicons/react` StarIcon, `clsx`, Server Actions with `useActionState`.

**Repos:**
- Backend: `/Users/itsjusteric/CrowCommerce/Templates/medusa-backend/`
- Storefront: `/Users/itsjusteric/CrowCommerce/Templates/commerce-tailwindui-medusa/`

**Reference:**
- Medusa tutorial: https://docs.medusajs.com/resources/how-to-tutorials/tutorials/product-reviews
- TailwindPlus components: `/Users/itsjusteric/CrowCommerce/Resources/TailwindUI/tailwindplus-components.json`
- Design doc: `docs/plans/2026-02-21-product-reviews-design.md`

---

## Phase 1: Medusa Backend

All files in this phase are created/modified in `/Users/itsjusteric/CrowCommerce/Templates/medusa-backend/`.

### Task 1: Create Review Data Model

**Files:**
- Create: `src/modules/product-review/models/review.ts`

**Step 1: Create the data model file**

```typescript
// src/modules/product-review/models/review.ts
import { model } from "@medusajs/framework/utils"

const Review = model.define("review", {
  id: model.id().primaryKey(),
  title: model.text().nullable(),
  content: model.text(),
  rating: model.float(),
  first_name: model.text(),
  last_name: model.text(),
  status: model.enum(["pending", "approved", "flagged"]).default("approved"),
  product_id: model.text().index("IDX_REVIEW_PRODUCT_ID"),
  customer_id: model.text().nullable(),
})
.checks([
  {
    name: "rating_range",
    expression: (columns) => `${columns.rating} >= 1 AND ${columns.rating} <= 5`,
  },
])

export default Review
```

Note: Status defaults to `"approved"` (auto-publish). The tutorial uses `"pending"` but we chose auto-publish with flagging. Status options: `pending`, `approved`, `flagged`.

**Step 2: Commit**

```bash
cd /Users/itsjusteric/CrowCommerce/Templates/medusa-backend
git add src/modules/product-review/models/review.ts
git commit -m "feat: add review data model with rating constraint"
```

---

### Task 2: Create Module Service and Definition

**Files:**
- Create: `src/modules/product-review/service.ts`
- Create: `src/modules/product-review/index.ts`

**Step 1: Create the service**

```typescript
// src/modules/product-review/service.ts
import { InjectManager, MedusaService, MedusaContext } from "@medusajs/framework/utils"
import Review from "./models/review"
import { Context } from "@medusajs/framework/types"
import { EntityManager } from "@medusajs/framework/mikro-orm/knex"

class ProductReviewModuleService extends MedusaService({
  Review,
}) {
  @InjectManager()
  async getAverageRating(
    productId: string,
    @MedusaContext() sharedContext?: Context<EntityManager>
  ): Promise<number> {
    const result = await sharedContext?.manager?.execute(
      `SELECT AVG(rating) as average FROM review WHERE product_id = $1 AND status = 'approved'`,
      [productId]
    )

    return parseFloat(parseFloat(result?.[0]?.average ?? 0).toFixed(2))
  }

  @InjectManager()
  async getRatingDistribution(
    productId: string,
    @MedusaContext() sharedContext?: Context<EntityManager>
  ): Promise<{ rating: number; count: number }[]> {
    const result = await sharedContext?.manager?.execute(
      `SELECT rating::int as rating, COUNT(*)::int as count
       FROM review
       WHERE product_id = $1 AND status = 'approved'
       GROUP BY rating::int
       ORDER BY rating DESC`,
      [productId]
    )

    return result ?? []
  }
}

export default ProductReviewModuleService
```

Note: Uses parameterized queries (`$1`) instead of string interpolation for SQL injection safety. Added `getRatingDistribution` for the Amazon-style 5-star breakdown bars.

**Step 2: Create the module definition**

```typescript
// src/modules/product-review/index.ts
import { Module } from "@medusajs/framework/utils"
import ProductReviewModuleService from "./service"

export const PRODUCT_REVIEW_MODULE = "productReview"

export default Module(PRODUCT_REVIEW_MODULE, {
  service: ProductReviewModuleService,
})
```

**Step 3: Commit**

```bash
cd /Users/itsjusteric/CrowCommerce/Templates/medusa-backend
git add src/modules/product-review/service.ts src/modules/product-review/index.ts
git commit -m "feat: add product review module service and definition"
```

---

### Task 3: Register Module and Run Migrations

**Files:**
- Modify: `medusa-config.ts` (add modules array)

**Step 1: Add the module to medusa-config.ts**

Add `modules` array to the `defineConfig` call:

```typescript
// medusa-config.ts
import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    }
  },
  modules: [
    {
      resolve: "./src/modules/product-review",
    },
  ],
})
```

**Step 2: Generate and run migrations**

```bash
cd /Users/itsjusteric/CrowCommerce/Templates/medusa-backend
npx medusa db:generate productReview
npx medusa db:migrate
```

Expected: Migration file created in `src/modules/product-review/migrations/`, and the `review` table created in PostgreSQL with `rating_range` check constraint.

**Step 3: Commit**

```bash
cd /Users/itsjusteric/CrowCommerce/Templates/medusa-backend
git add medusa-config.ts src/modules/product-review/migrations/
git commit -m "feat: register product review module and run migrations"
```

---

### Task 4: Define Review-Product Link

**Files:**
- Create: `src/links/review-product.ts`

**Step 1: Create the link definition**

```typescript
// src/links/review-product.ts
import { defineLink } from "@medusajs/framework/utils"
import ProductReviewModule from "../modules/product-review"
import ProductModule from "@medusajs/medusa/product"

export default defineLink(
  {
    linkable: ProductReviewModule.linkable.review,
    field: "product_id",
    isList: false,
  },
  ProductModule.linkable.product,
  {
    readOnly: true,
  }
)
```

**Step 2: Run migration for the link**

```bash
cd /Users/itsjusteric/CrowCommerce/Templates/medusa-backend
npx medusa db:migrate
```

**Step 3: Commit**

```bash
cd /Users/itsjusteric/CrowCommerce/Templates/medusa-backend
git add src/links/review-product.ts
git commit -m "feat: add review-product module link"
```

---

### Task 5: Create Review Workflow

**Files:**
- Create: `src/workflows/steps/create-review.ts`
- Create: `src/workflows/create-review.ts`

**Step 1: Create the create-review step**

```typescript
// src/workflows/steps/create-review.ts
import {
  createStep,
  StepResponse,
} from "@medusajs/framework/workflows-sdk"
import { PRODUCT_REVIEW_MODULE } from "../../modules/product-review"
import ProductReviewModuleService from "../../modules/product-review/service"

export type CreateReviewStepInput = {
  title?: string
  content: string
  rating: number
  product_id: string
  customer_id?: string
  first_name: string
  last_name: string
  status?: "pending" | "approved" | "flagged"
}

export const createReviewStep = createStep(
  "create-review",
  async (input: CreateReviewStepInput, { container }) => {
    const reviewModuleService: ProductReviewModuleService = container.resolve(
      PRODUCT_REVIEW_MODULE
    )

    const review = await reviewModuleService.createReviews(input)

    return new StepResponse(review, review.id)
  },
  async (reviewId, { container }) => {
    if (!reviewId) {
      return
    }

    const reviewModuleService: ProductReviewModuleService = container.resolve(
      PRODUCT_REVIEW_MODULE
    )

    await reviewModuleService.deleteReviews(reviewId)
  }
)
```

**Step 2: Create the workflow**

```typescript
// src/workflows/create-review.ts
import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { createReviewStep } from "./steps/create-review"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"

type CreateReviewInput = {
  title?: string
  content: string
  rating: number
  product_id: string
  customer_id?: string
  first_name: string
  last_name: string
  status?: "pending" | "approved" | "flagged"
}

export const createReviewWorkflow = createWorkflow(
  "create-review",
  (input: CreateReviewInput) => {
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

    return new WorkflowResponse({
      review,
    })
  }
)
```

**Step 3: Commit**

```bash
cd /Users/itsjusteric/CrowCommerce/Templates/medusa-backend
git add src/workflows/steps/create-review.ts src/workflows/create-review.ts
git commit -m "feat: add create review workflow with product validation"
```

---

### Task 6: Update Review Workflow (Status Changes)

**Files:**
- Create: `src/workflows/steps/update-review.ts`
- Create: `src/workflows/update-review.ts`

**Step 1: Create the update-review step**

```typescript
// src/workflows/steps/update-review.ts
import {
  createStep,
  StepResponse,
} from "@medusajs/framework/workflows-sdk"
import { PRODUCT_REVIEW_MODULE } from "../../modules/product-review"
import ProductReviewModuleService from "../../modules/product-review/service"

export type UpdateReviewsStepInput = {
  id: string
  status: "pending" | "approved" | "flagged"
}[]

export const updateReviewsStep = createStep(
  "update-review-step",
  async (input: UpdateReviewsStepInput, { container }) => {
    const reviewModuleService: ProductReviewModuleService = container.resolve(
      PRODUCT_REVIEW_MODULE
    )

    const originalReviews = await reviewModuleService.listReviews({
      id: input.map((review) => review.id),
    })

    const reviews = await reviewModuleService.updateReviews(input)

    return new StepResponse(reviews, originalReviews)
  },
  async (originalData, { container }) => {
    if (!originalData) {
      return
    }

    const reviewModuleService: ProductReviewModuleService = container.resolve(
      PRODUCT_REVIEW_MODULE
    )

    await reviewModuleService.updateReviews(originalData)
  }
)
```

**Step 2: Create the workflow**

```typescript
// src/workflows/update-review.ts
import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { updateReviewsStep } from "./steps/update-review"

export type UpdateReviewInput = {
  id: string
  status: "pending" | "approved" | "flagged"
}[]

export const updateReviewWorkflow = createWorkflow(
  "update-review",
  (input: UpdateReviewInput) => {
    const reviews = updateReviewsStep(input)

    return new WorkflowResponse({
      reviews,
    })
  }
)
```

**Step 3: Commit**

```bash
cd /Users/itsjusteric/CrowCommerce/Templates/medusa-backend
git add src/workflows/steps/update-review.ts src/workflows/update-review.ts
git commit -m "feat: add update review workflow for status changes"
```

---

### Task 7: Store API Routes

**Files:**
- Create: `src/api/store/reviews/route.ts`
- Create: `src/api/store/products/[id]/reviews/route.ts`

**Step 1: Create POST /store/reviews route**

```typescript
// src/api/store/reviews/route.ts
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { createReviewWorkflow } from "../../../workflows/create-review"
import { z } from "@medusajs/framework/zod"

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
})

type PostStoreReviewReq = z.infer<typeof PostStoreReviewSchema>

export const POST = async (
  req: AuthenticatedMedusaRequest<PostStoreReviewReq>,
  res: MedusaResponse
) => {
  const input = req.validatedBody

  const { result } = await createReviewWorkflow(req.scope)
    .run({
      input: {
        ...input,
        customer_id: req.auth_context?.actor_id,
      },
    })

  res.json(result)
}
```

**Step 2: Create GET /store/products/[id]/reviews route**

```typescript
// src/api/store/products/[id]/reviews/route.ts
import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PRODUCT_REVIEW_MODULE } from "../../../../../modules/product-review"
import ProductReviewModuleService from "../../../../../modules/product-review/service"
import { createFindParams } from "@medusajs/medusa/api/utils/validators"

export const GetStoreReviewsSchema = createFindParams()

export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const reviewModuleService: ProductReviewModuleService = req.scope.resolve(PRODUCT_REVIEW_MODULE)

  const { data: reviews, metadata: {
    count,
    take,
    skip,
  } = { count: 0, take: 10, skip: 0 } } = await query.graph({
    entity: "review",
    filters: {
      product_id: id,
      status: "approved",
    },
    ...req.queryConfig,
  })

  const [averageRating, ratingDistribution] = await Promise.all([
    reviewModuleService.getAverageRating(id),
    reviewModuleService.getRatingDistribution(id),
  ])

  res.json({
    reviews,
    count,
    limit: take,
    offset: skip,
    average_rating: averageRating,
    rating_distribution: ratingDistribution,
  })
}
```

**Step 3: Commit**

```bash
cd /Users/itsjusteric/CrowCommerce/Templates/medusa-backend
git add src/api/store/reviews/route.ts src/api/store/products/\[id\]/reviews/route.ts
git commit -m "feat: add store API routes for creating and listing reviews"
```

---

### Task 8: Admin API Routes

**Files:**
- Create: `src/api/admin/reviews/route.ts`
- Create: `src/api/admin/reviews/status/route.ts`

**Step 1: Create GET /admin/reviews route**

```typescript
// src/api/admin/reviews/route.ts
import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { createFindParams } from "@medusajs/medusa/api/utils/validators"

export const GetAdminReviewsSchema = createFindParams()

export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve("query")

  const {
    data: reviews,
    metadata: { count, take, skip } = {
      count: 0,
      take: 20,
      skip: 0,
    },
  } = await query.graph({
    entity: "review",
    ...req.queryConfig,
  })

  res.json({
    reviews,
    count,
    limit: take,
    offset: skip,
  })
}
```

**Step 2: Create POST /admin/reviews/status route**

```typescript
// src/api/admin/reviews/status/route.ts
import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { updateReviewWorkflow } from "../../../../workflows/update-review"
import { z } from "@medusajs/framework/zod"

export const PostAdminUpdateReviewsStatusSchema = z.object({
  ids: z.array(z.string()),
  status: z.enum(["pending", "approved", "flagged"]),
})

export async function POST(
  req: MedusaRequest<z.infer<typeof PostAdminUpdateReviewsStatusSchema>>,
  res: MedusaResponse
) {
  const { ids, status } = req.validatedBody

  const { result } = await updateReviewWorkflow(req.scope).run({
    input: ids.map((id) => ({
      id,
      status,
    })),
  })

  res.json(result)
}
```

**Step 3: Commit**

```bash
cd /Users/itsjusteric/CrowCommerce/Templates/medusa-backend
git add src/api/admin/reviews/route.ts src/api/admin/reviews/status/route.ts
git commit -m "feat: add admin API routes for listing reviews and updating status"
```

---

### Task 9: Middleware Configuration

**Files:**
- Create: `src/api/middlewares.ts`

**Step 1: Create the middlewares file**

```typescript
// src/api/middlewares.ts
import {
  defineMiddlewares,
  authenticate,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import { PostStoreReviewSchema } from "./store/reviews/route"
import { PostAdminUpdateReviewsStatusSchema } from "./admin/reviews/status/route"
import { GetAdminReviewsSchema } from "./admin/reviews/route"
import { GetStoreReviewsSchema } from "./store/products/[id]/reviews/route"

export default defineMiddlewares({
  routes: [
    {
      method: ["POST"],
      matcher: "/store/reviews",
      middlewares: [
        authenticate("customer", ["session", "bearer"]),
        validateAndTransformBody(PostStoreReviewSchema),
      ],
    },
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
          ],
        }),
      ],
    },
  ],
})
```

**Step 2: Commit**

```bash
cd /Users/itsjusteric/CrowCommerce/Templates/medusa-backend
git add src/api/middlewares.ts
git commit -m "feat: add middleware for review API route validation and auth"
```

---

### Task 10: Admin Dashboard Reviews Page

**Files:**
- Create: `src/admin/lib/sdk.ts`
- Create: `src/admin/routes/reviews/page.tsx`

**Step 1: Create admin SDK client**

```typescript
// src/admin/lib/sdk.ts
import Medusa from "@medusajs/js-sdk"

export const sdk = new Medusa({
  baseUrl: "http://localhost:9000",
  debug: process.env.NODE_ENV === "development",
  auth: {
    type: "session",
  },
})
```

**Step 2: Create the reviews admin page**

```tsx
// src/admin/routes/reviews/page.tsx
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ChatBubbleLeftRight } from "@medusajs/icons"
import {
  createDataTableColumnHelper,
  Container,
  DataTable,
  useDataTable,
  Heading,
  StatusBadge,
  Toaster,
  DataTablePaginationState,
  createDataTableCommandHelper,
  DataTableRowSelectionState,
} from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { sdk } from "../../lib/sdk"
import { HttpTypes } from "@medusajs/framework/types"
import { Link } from "react-router-dom"
import { toast } from "@medusajs/ui"

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
}

const columnHelper = createDataTableColumnHelper<Review>()

const columns = [
  columnHelper.select(),
  columnHelper.accessor("id", {
    header: "ID",
  }),
  columnHelper.accessor("title", {
    header: "Title",
  }),
  columnHelper.accessor("rating", {
    header: "Rating",
  }),
  columnHelper.accessor("content", {
    header: "Content",
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: ({ row }) => {
      const color = row.original.status === "approved"
        ? "green"
        : row.original.status === "flagged"
        ? "red"
        : "grey"
      return (
        <StatusBadge color={color}>
          {row.original.status.charAt(0).toUpperCase() + row.original.status.slice(1)}
        </StatusBadge>
      )
    },
  }),
  columnHelper.accessor("product", {
    header: "Product",
    cell: ({ row }) => {
      return (
        <Link to={`/products/${row.original.product_id}`}>
          {row.original.product?.title}
        </Link>
      )
    },
  }),
]

const commandHelper = createDataTableCommandHelper()

const useCommands = (refetch: () => void) => {
  return [
    commandHelper.command({
      label: "Approve",
      shortcut: "A",
      action: async (selection) => {
        const ids = Object.keys(selection)

        sdk.client.fetch("/admin/reviews/status", {
          method: "POST",
          body: {
            ids,
            status: "approved",
          },
        }).then(() => {
          toast.success("Reviews approved")
          refetch()
        }).catch(() => {
          toast.error("Failed to approve reviews")
        })
      },
    }),
    commandHelper.command({
      label: "Flag",
      shortcut: "F",
      action: async (selection) => {
        const ids = Object.keys(selection)

        sdk.client.fetch("/admin/reviews/status", {
          method: "POST",
          body: {
            ids,
            status: "flagged",
          },
        }).then(() => {
          toast.success("Reviews flagged")
          refetch()
        }).catch(() => {
          toast.error("Failed to flag reviews")
        })
      },
    }),
  ]
}

const limit = 15

const ReviewsPage = () => {
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageSize: limit,
    pageIndex: 0,
  })

  const [rowSelection, setRowSelection] = useState<DataTableRowSelectionState>({})

  const offset = useMemo(() => {
    return pagination.pageIndex * limit
  }, [pagination])

  const { data, isLoading, refetch } = useQuery<{
    reviews: Review[]
    count: number
    limit: number
    offset: number
  }>({
    queryKey: ["reviews", offset, limit],
    queryFn: () => sdk.client.fetch("/admin/reviews", {
      query: {
        offset: pagination.pageIndex * pagination.pageSize,
        limit: pagination.pageSize,
        order: "-created_at",
      },
    }),
  })

  const commands = useCommands(refetch)

  const table = useDataTable({
    columns,
    data: data?.reviews || [],
    rowCount: data?.count || 0,
    isLoading,
    pagination: {
      state: pagination,
      onPaginationChange: setPagination,
    },
    commands,
    rowSelection: {
      state: rowSelection,
      onRowSelectionChange: setRowSelection,
    },
    getRowId: (row) => row.id,
  })

  return (
    <Container>
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex flex-col items-start justify-between gap-2 md:flex-row md:items-center">
          <Heading>Reviews</Heading>
        </DataTable.Toolbar>
        <DataTable.Table />
        <DataTable.Pagination />
        <DataTable.CommandBar selectedLabel={(count) => `${count} selected`} />
      </DataTable>
      <Toaster />
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Reviews",
  icon: ChatBubbleLeftRight,
})

export default ReviewsPage
```

**Step 3: Commit**

```bash
cd /Users/itsjusteric/CrowCommerce/Templates/medusa-backend
git add src/admin/lib/sdk.ts src/admin/routes/reviews/page.tsx
git commit -m "feat: add admin reviews page with DataTable and bulk actions"
```

---

### Task 11: Test Backend End-to-End

**Step 1: Start the backend**

```bash
cd /Users/itsjusteric/CrowCommerce/Templates/medusa-backend
npm run dev
```

**Step 2: Test the store reviews GET endpoint**

Pick any product ID from the admin dashboard and test:

```bash
curl http://localhost:9000/store/products/{PRODUCT_ID}/reviews \
  -H "x-publishable-api-key: {PUBLISHABLE_KEY}"
```

Expected: `{ "reviews": [], "count": 0, "limit": 10, "offset": 0, "average_rating": 0, "rating_distribution": [] }`

**Step 3: Test the admin reviews GET endpoint**

```bash
curl http://localhost:9000/admin/reviews \
  -H "Cookie: {ADMIN_SESSION_COOKIE}"
```

Expected: `{ "reviews": [], "count": 0, "limit": 20, "offset": 0 }`

**Step 4: Verify admin UI**

Navigate to `http://localhost:9000/app` and check the sidebar for the "Reviews" link. Click it and verify the DataTable renders (empty state).

---

## Phase 2: Next.js Storefront

All files in this phase are created/modified in `/Users/itsjusteric/CrowCommerce/Templates/commerce-tailwindui-medusa/`.

### Task 12: Add Review Types and Cache Tag

**Files:**
- Modify: `lib/types.ts` (add Review and ProductReviews types)
- Modify: `lib/constants.ts` (add reviews cache tag)

**Step 1: Add types to lib/types.ts**

Append to the end of the file:

```typescript
// --- Reviews ---

export type Review = {
  id: string;
  title: string;
  content: string;
  rating: number;
  first_name: string;
  last_name: string;
  created_at: string;
};

export type ProductReviews = {
  reviews: Review[];
  averageRating: number;
  count: number;
  ratingDistribution: { rating: number; count: number }[];
};
```

**Step 2: Add cache tag to lib/constants.ts**

Change the TAGS object to include `reviews`:

```typescript
export const TAGS = {
  collections: "collections",
  products: "products",
  cart: "cart",
  customers: "customers",
  reviews: "reviews",
};
```

**Step 3: Commit**

```bash
git add lib/types.ts lib/constants.ts
git commit -m "feat: add review types and cache tag"
```

---

### Task 13: Create Reviews Data Layer

**Files:**
- Create: `lib/medusa/reviews.ts`

**Step 1: Create the reviews data layer**

```typescript
// lib/medusa/reviews.ts
"use server";

import { sdk } from "lib/medusa";
import { TAGS } from "lib/constants";
import type { ProductReviews, Review } from "lib/types";
import { revalidatePath, revalidateTag } from "next/cache";
import { cacheLife, cacheTag } from "next/cache";
import { getAuthHeaders } from "lib/medusa/cookies";
import { retrieveCustomer } from "lib/medusa/customer";

export type ReviewActionResult = { error?: string; success?: boolean } | null;

export async function getProductReviews(
  productId: string,
  { limit = 10, offset = 0 }: { limit?: number; offset?: number } = {},
): Promise<ProductReviews> {
  "use cache";
  cacheTag(TAGS.reviews);
  cacheLife("days");

  const response = await sdk.client.fetch<{
    reviews: Review[];
    average_rating: number;
    count: number;
    limit: number;
    offset: number;
    rating_distribution: { rating: number; count: number }[];
  }>(`/store/products/${productId}/reviews`, {
    method: "GET",
    query: {
      limit,
      offset,
      order: "-created_at",
    },
  });

  // Build full 1-5 distribution (fill missing ratings with 0)
  const distributionMap = new Map(
    response.rating_distribution.map((d) => [d.rating, d.count]),
  );
  const ratingDistribution = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: distributionMap.get(rating) ?? 0,
  }));

  return {
    reviews: response.reviews,
    averageRating: response.average_rating,
    count: response.count,
    ratingDistribution,
  };
}

export async function addProductReview(
  prevState: ReviewActionResult,
  formData: FormData,
): Promise<ReviewActionResult> {
  const productId = formData.get("product_id") as string;
  const title = (formData.get("title") as string)?.trim() || undefined;
  const content = (formData.get("content") as string)?.trim();
  const rating = Number(formData.get("rating"));

  if (!content) return { error: "Review content is required" };
  if (!rating || rating < 1 || rating > 5) return { error: "Please select a rating" };

  const customer = await retrieveCustomer();
  if (!customer) return { error: "You must be logged in to leave a review" };

  const headers = await getAuthHeaders();

  try {
    await sdk.client.fetch("/store/reviews", {
      method: "POST",
      headers,
      body: {
        product_id: productId,
        title,
        content,
        rating,
        first_name: customer.first_name || "Customer",
        last_name: customer.last_name || "",
      },
    });
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Error submitting review",
    };
  } finally {
    revalidateTag(TAGS.reviews, "max");
    revalidatePath("/", "layout");
  }

  return { success: true };
}
```

Note: `addProductReview` follows the same `(prevState, formData)` Server Action pattern used by `customer.ts`. The `getProductReviews` function uses `"use cache"` like other data-fetching functions in this codebase.

**Step 2: Commit**

```bash
git add lib/medusa/reviews.ts
git commit -m "feat: add reviews data layer with caching and server action"
```

---

### Task 14: Create StarRating Component

**Files:**
- Create: `components/reviews/StarRating.tsx`

**Step 1: Create the star rating display component**

Based on the TailwindPlus star pattern using `@heroicons/react/20/solid`:

```tsx
// components/reviews/StarRating.tsx
import { StarIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";

export function StarRating({
  rating,
  size = "sm",
}: {
  rating: number;
  size?: "sm" | "md";
}) {
  return (
    <div className="flex items-center">
      {[0, 1, 2, 3, 4].map((index) => (
        <StarIcon
          key={index}
          aria-hidden="true"
          className={clsx(
            rating > index ? "text-yellow-400" : "text-gray-300",
            size === "sm" ? "size-5" : "size-6",
            "shrink-0",
          )}
        />
      ))}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/reviews/StarRating.tsx
git commit -m "feat: add reusable StarRating component"
```

---

### Task 15: Create ReviewSummary Component

**Files:**
- Create: `components/reviews/ReviewSummary.tsx`

**Step 1: Create the review summary with rating bars**

Based on TailwindPlus `Ecommerce > Components > Reviews > With summary chart`:

```tsx
// components/reviews/ReviewSummary.tsx
import { StarIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";
import type { ProductReviews } from "lib/types";

export function ReviewSummary({
  reviews,
  onWriteReview,
  canReview,
}: {
  reviews: ProductReviews;
  onWriteReview?: () => void;
  canReview: boolean;
}) {
  return (
    <div className="lg:col-span-4">
      <h2 className="text-2xl font-bold tracking-tight text-gray-900">
        Customer Reviews
      </h2>

      <div className="mt-3 flex items-center">
        <div>
          <div className="flex items-center">
            {[0, 1, 2, 3, 4].map((rating) => (
              <StarIcon
                key={rating}
                aria-hidden="true"
                className={clsx(
                  reviews.averageRating > rating
                    ? "text-yellow-400"
                    : "text-gray-300",
                  "size-5 shrink-0",
                )}
              />
            ))}
          </div>
          <p className="sr-only">
            {reviews.averageRating} out of 5 stars
          </p>
        </div>
        <p className="ml-2 text-sm text-gray-900">
          Based on {reviews.count} review{reviews.count !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="mt-6">
        <h3 className="sr-only">Review data</h3>

        <dl className="space-y-3">
          {reviews.ratingDistribution.map((item) => (
            <div
              key={item.rating}
              className="flex items-center text-sm"
            >
              <dt className="flex flex-1 items-center">
                <p className="w-3 font-medium text-gray-900">
                  {item.rating}
                  <span className="sr-only"> star reviews</span>
                </p>
                <div
                  aria-hidden="true"
                  className="ml-1 flex flex-1 items-center"
                >
                  <StarIcon
                    aria-hidden="true"
                    className={clsx(
                      item.count > 0 ? "text-yellow-400" : "text-gray-300",
                      "size-5 shrink-0",
                    )}
                  />

                  <div className="relative ml-3 flex-1">
                    <div className="h-3 rounded-full border border-gray-200 bg-gray-100" />
                    {item.count > 0 && reviews.count > 0 ? (
                      <div
                        style={{
                          width: `calc(${item.count} / ${reviews.count} * 100%)`,
                        }}
                        className="absolute inset-y-0 rounded-full border border-yellow-400 bg-yellow-400"
                      />
                    ) : null}
                  </div>
                </div>
              </dt>
              <dd className="ml-3 w-10 text-right text-sm tabular-nums text-gray-900">
                {reviews.count > 0
                  ? Math.round((item.count / reviews.count) * 100)
                  : 0}
                %
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {canReview && (
        <div className="mt-10">
          <h3 className="text-lg font-medium text-gray-900">
            Share your thoughts
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            If you&apos;ve used this product, share your thoughts with
            other customers
          </p>

          <button
            type="button"
            onClick={onWriteReview}
            className="mt-6 inline-flex w-full items-center justify-center rounded-md border border-gray-300 bg-white px-8 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 sm:w-auto lg:w-full"
          >
            Write a review
          </button>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/reviews/ReviewSummary.tsx
git commit -m "feat: add ReviewSummary component with 5-star breakdown bars"
```

---

### Task 16: Create ReviewList Component

**Files:**
- Create: `components/reviews/ReviewList.tsx`

**Step 1: Create the review list**

Based on TailwindPlus `Ecommerce > Components > Reviews > Simple with avatars` (adapted without avatar images since we don't have them):

```tsx
// components/reviews/ReviewList.tsx
import { StarIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";
import type { Review } from "lib/types";
import { DEFAULT_LOCALE } from "lib/constants";

export function ReviewList({ reviews }: { reviews: Review[] }) {
  if (reviews.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No reviews yet. Be the first to share your thoughts!
      </p>
    );
  }

  return (
    <div className="flow-root">
      <div className="-my-12 divide-y divide-gray-200">
        {reviews.map((review) => (
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
                <p className="sr-only">
                  {review.rating} out of 5 stars
                </p>
              </div>
            </div>

            {review.title && (
              <h5 className="mt-4 text-sm font-semibold text-gray-900">
                {review.title}
              </h5>
            )}

            <p className="mt-2 text-sm text-gray-600">
              {review.content}
            </p>

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
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/reviews/ReviewList.tsx
git commit -m "feat: add ReviewList component with avatars and dates"
```

---

### Task 17: Create ReviewForm Dialog Component

**Files:**
- Create: `components/reviews/ReviewForm.tsx`

**Step 1: Create the review form modal**

Uses Headless UI `Dialog` (consistent with cart drawer and mobile menu patterns):

```tsx
// components/reviews/ReviewForm.tsx
"use client";

import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { XMarkIcon, StarIcon } from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolid } from "@heroicons/react/20/solid";
import clsx from "clsx";
import { addProductReview, type ReviewActionResult } from "lib/medusa/reviews";
import { useActionState, useState } from "react";

export function ReviewForm({
  productId,
  open,
  onClose,
}: {
  productId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);

  const [state, formAction, isPending] = useActionState<
    ReviewActionResult,
    FormData
  >(addProductReview, null);

  const displayRating = hoverRating || rating;

  if (state?.success) {
    return (
      <Dialog open={open} onClose={onClose} className="relative z-50">
        <DialogBackdrop className="fixed inset-0 bg-gray-500/75 transition-opacity" />
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <DialogPanel className="relative w-full max-w-lg rounded-lg bg-white px-6 py-8 text-center shadow-xl">
              <DialogTitle className="text-lg font-semibold text-gray-900">
                Thank you!
              </DialogTitle>
              <p className="mt-2 text-sm text-gray-600">
                Your review has been posted.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-6 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500"
              >
                Done
              </button>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-gray-500/75 transition-opacity" />

      <div className="fixed inset-0 z-10 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <DialogPanel className="relative w-full max-w-lg rounded-lg bg-white px-6 py-8 shadow-xl">
            <div className="absolute right-4 top-4">
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">Close</span>
                <XMarkIcon className="size-6" aria-hidden="true" />
              </button>
            </div>

            <DialogTitle className="text-lg font-semibold text-gray-900">
              Write a review
            </DialogTitle>

            <form action={formAction} className="mt-6 space-y-6">
              <input type="hidden" name="product_id" value={productId} />
              <input type="hidden" name="rating" value={rating} />

              {/* Star Rating Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Rating
                </label>
                <div className="mt-2 flex gap-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-0.5"
                    >
                      {displayRating >= star ? (
                        <StarIconSolid className="size-8 text-yellow-400" />
                      ) : (
                        <StarIcon className="size-8 text-gray-300" />
                      )}
                      <span className="sr-only">
                        {star} star{star !== 1 ? "s" : ""}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label
                  htmlFor="review-title"
                  className="block text-sm font-medium text-gray-700"
                >
                  Title{" "}
                  <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  id="review-title"
                  name="title"
                  className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="Summarize your experience"
                />
              </div>

              {/* Content */}
              <div>
                <label
                  htmlFor="review-content"
                  className="block text-sm font-medium text-gray-700"
                >
                  Review
                </label>
                <textarea
                  id="review-content"
                  name="content"
                  rows={4}
                  required
                  className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="What did you like or dislike about this product?"
                />
              </div>

              {/* Error */}
              {state?.error && (
                <p className="text-sm text-red-600">{state.error}</p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isPending || rating === 0}
                className={clsx(
                  "w-full rounded-md px-4 py-2.5 text-sm font-semibold text-white shadow-sm",
                  isPending || rating === 0
                    ? "cursor-not-allowed bg-gray-300"
                    : "bg-primary-600 hover:bg-primary-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600",
                )}
              >
                {isPending ? "Submitting..." : "Submit review"}
              </button>
            </form>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
```

**Step 2: Commit**

```bash
git add components/reviews/ReviewForm.tsx
git commit -m "feat: add ReviewForm dialog with star selector and server action"
```

---

### Task 18: Create ProductReviews Composite Component

**Files:**
- Create: `components/reviews/ProductReviews.tsx`

**Step 1: Create the composite component**

This component brings everything together — it's a client component wrapper for the interactive parts (dialog, load more) that receives server-fetched data:

```tsx
// components/reviews/ProductReviews.tsx
"use client";

import { useState, useTransition } from "react";
import { ReviewSummary } from "components/reviews/ReviewSummary";
import { ReviewList } from "components/reviews/ReviewList";
import { ReviewForm } from "components/reviews/ReviewForm";
import type { ProductReviews as ProductReviewsType, Review } from "lib/types";
import { getProductReviews } from "lib/medusa/reviews";

export function ProductReviews({
  productId,
  initialData,
  canReview,
}: {
  productId: string;
  initialData: ProductReviewsType;
  canReview: boolean;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [reviews, setReviews] = useState<Review[]>(initialData.reviews);
  const [hasMore, setHasMore] = useState(
    initialData.count > initialData.reviews.length,
  );
  const [isLoadingMore, startLoadMore] = useTransition();

  function loadMore() {
    startLoadMore(async () => {
      const data = await getProductReviews(productId, {
        limit: 10,
        offset: reviews.length,
      });
      setReviews((prev) => [...prev, ...data.reviews]);
      setHasMore(data.count > reviews.length + data.reviews.length);
    });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24 lg:grid lg:max-w-7xl lg:grid-cols-12 lg:gap-x-8 lg:px-8 lg:py-32">
      <ReviewSummary
        reviews={initialData}
        canReview={canReview}
        onWriteReview={() => setFormOpen(true)}
      />

      <div className="mt-16 lg:col-span-7 lg:col-start-6 lg:mt-0">
        <h3 className="sr-only">Recent reviews</h3>
        <ReviewList reviews={reviews} />

        {hasMore && (
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={loadMore}
              disabled={isLoadingMore}
              className="rounded-md border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
            >
              {isLoadingMore ? "Loading..." : "Load more reviews"}
            </button>
          </div>
        )}
      </div>

      {canReview && (
        <ReviewForm
          productId={productId}
          open={formOpen}
          onClose={() => setFormOpen(false)}
        />
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/reviews/ProductReviews.tsx
git commit -m "feat: add ProductReviews composite with load more and dialog"
```

---

### Task 19: Integrate Reviews into Product Detail Page

**Files:**
- Modify: `app/product/[handle]/page.tsx`
- Modify: `components/product/product-page-content.tsx`

**Step 1: Add reviews data fetching in the page**

Modify `app/product/[handle]/page.tsx` to add a `<ProductReviewsSection>` server component:

Add these imports at the top:

```typescript
import { ProductReviews } from "components/reviews/ProductReviews";
import { getProductReviews } from "lib/medusa/reviews";
import { retrieveCustomer } from "lib/medusa/customer";
```

Add a new server component at the bottom of the file (after `RelatedProducts`):

```typescript
async function ProductReviewsSection({
  productPromise,
}: {
  productPromise: Promise<Product | undefined>;
}) {
  const product = await productPromise;
  if (!product) return null;

  const [reviewsData, customer] = await Promise.all([
    getProductReviews(product.id),
    retrieveCustomer(),
  ]);

  const canReview = !!customer;

  return (
    <div className="bg-white">
      <ProductReviews
        productId={product.id}
        initialData={reviewsData}
        canReview={canReview}
      />
    </div>
  );
}
```

**Step 2: Add the reviews slot to ProductPageContent**

Modify `components/product/product-page-content.tsx`:

Add `reviewsSlot` prop:

```tsx
export function ProductPageContent({
  productPromise,
  relatedProductsSlot,
  reviewsSlot,
}: {
  productPromise: Promise<Product | undefined>;
  relatedProductsSlot: ReactNode;
  reviewsSlot: ReactNode;
}) {
```

Add `{reviewsSlot}` between `</Suspense>` (after ProductProvider) and `{relatedProductsSlot}`:

```tsx
      </Suspense>
      {reviewsSlot}
      {relatedProductsSlot}
```

**Step 3: Pass the reviews slot in the page**

In `app/product/[handle]/page.tsx`, update the `ProductPageContent` usage to include the reviews slot:

```tsx
  return (
    <ProductPageContent
      productPromise={productPromise}
      reviewsSlot={
        <Suspense
          fallback={
            <div className="mx-auto max-w-7xl px-4 py-8">
              <div className="h-32 animate-pulse rounded bg-gray-200" />
            </div>
          }
        >
          <ProductReviewsSection productPromise={productPromise} />
        </Suspense>
      }
      relatedProductsSlot={
        <Suspense
          fallback={
            <div className="mx-auto max-w-7xl px-4 py-8">
              <h2 className="mb-4 text-xl font-bold text-gray-900">
                Customers also bought
              </h2>
              <div className="h-24 animate-pulse rounded bg-gray-200" />
            </div>
          }
        >
          <RelatedProducts productPromise={productPromise} />
        </Suspense>
      }
    />
  );
```

**Step 4: Add aggregateRating to Product JSON-LD**

In `components/product/product-page-content.tsx`, the `productJsonLd` is already defined. We don't add `aggregateRating` here because this is a client component with `use(productPromise)` — review data isn't available here. The `aggregateRating` structured data can be added in a future enhancement by passing review data through a prop. Skip for now to keep scope manageable.

**Step 5: Commit**

```bash
git add app/product/\[handle\]/page.tsx components/product/product-page-content.tsx
git commit -m "feat: integrate product reviews into product detail page"
```

---

### Task 20: Test End-to-End

**Step 1: Start both servers**

```bash
# Terminal 1
cd /Users/itsjusteric/CrowCommerce/Templates/medusa-backend && npm run dev

# Terminal 2
cd /Users/itsjusteric/CrowCommerce/Templates/commerce-tailwindui-medusa && bun dev
```

**Step 2: Verify reviews section renders**

Navigate to any product page (e.g., `http://localhost:3000/product/some-handle`). Verify:
- "Customer Reviews" section appears below product details
- Shows 0 reviews with empty bars
- No "Write a review" button when not logged in

**Step 3: Test review submission**

1. Log in as a customer
2. Navigate to a product page
3. Verify "Write a review" button appears
4. Click it — verify Dialog modal opens
5. Select star rating, add content, submit
6. Verify success message
7. Close dialog — verify review appears in list
8. Verify rating bars update

**Step 4: Test admin moderation**

1. Go to `http://localhost:9000/app`
2. Click "Reviews" in sidebar
3. Verify the submitted review appears
4. Select it, click "Flag" — verify status changes
5. Refresh storefront product page — verify flagged review no longer shows

---

## CORS Note

The Medusa backend `.env` has `STORE_CORS=http://localhost:8000`. If the storefront runs on port 3000, add `http://localhost:3000` to `STORE_CORS` and `AUTH_CORS` in `/Users/itsjusteric/CrowCommerce/Templates/medusa-backend/.env`:

```
STORE_CORS=http://localhost:8000,http://localhost:3000,https://docs.medusajs.com
AUTH_CORS=http://localhost:5173,http://localhost:9000,http://localhost:8000,http://localhost:3000,https://docs.medusajs.com
```
