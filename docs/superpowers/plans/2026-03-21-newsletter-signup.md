# Newsletter Signup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add newsletter signup to the storefront footer with backend subscriber management, Resend Audience sync, and a welcome email.

**Architecture:** Medusa custom module (`newsletter`) stores subscribers as source of truth. Public API routes handle subscribe/unsubscribe. Event-driven subscribers trigger Resend sync and welcome email workflows. Storefront footer form wired via server action.

**Tech Stack:** Medusa v2 (custom module, workflows, subscribers), Resend (Contacts API, React Email), Next.js 16 (server actions, `useActionState`), PostHog (analytics events)

**Spec:** `docs/superpowers/specs/2026-03-21-newsletter-signup-design.md`

---

### Task 1: Newsletter Module — Data Model

**Files:**
- Create: `backend/src/modules/newsletter/models/subscriber.ts`
- Create: `backend/src/modules/newsletter/service.ts`
- Create: `backend/src/modules/newsletter/index.ts`
- Modify: `backend/medusa-config.ts:66-75`

- [ ] **Step 1: Create the Subscriber data model**

```typescript
// backend/src/modules/newsletter/models/subscriber.ts
import { model } from "@medusajs/framework/utils"

export const Subscriber = model
  .define("newsletter_subscriber", {
    id: model.id({ prefix: "nsub" }).primaryKey(),
    email: model.text(),
    status: model.enum(["active", "pending", "unsubscribed"]).default("active"),
    source: model.enum(["footer", "checkout", "account", "import"]),
    customer_id: model.text().nullable(),
    resend_contact_id: model.text().nullable(),
    unsubscribed_at: model.dateTime().nullable(),
  })
  .indexes([
    {
      on: ["email"],
      unique: true,
    },
  ])
```

- [ ] **Step 2: Create the service class**

```typescript
// backend/src/modules/newsletter/service.ts
import { MedusaService } from "@medusajs/framework/utils"
import { Subscriber } from "./models/subscriber"

class NewsletterModuleService extends MedusaService({
  Subscriber,
}) {}

export default NewsletterModuleService
```

- [ ] **Step 3: Create the module definition**

```typescript
// backend/src/modules/newsletter/index.ts
import { Module } from "@medusajs/framework/utils"
import NewsletterModuleService from "./service"

export const NEWSLETTER_MODULE = "newsletter"

export default Module(NEWSLETTER_MODULE, {
  service: NewsletterModuleService,
})
```

- [ ] **Step 4: Register module in medusa-config.ts**

Add to the `modules` array after the `invoice` module entry (around line 75):

```typescript
{
  resolve: "./src/modules/newsletter",
},
```

- [ ] **Step 5: Generate and run the migration**

Run: `cd backend && bunx medusa db:generate newsletter_subscriber && bunx medusa db:migrate`

Expected: Migration created in `backend/src/modules/newsletter/migrations/` and applied successfully.

- [ ] **Step 6: Verify the module loads**

Run: `cd backend && bun run dev`

Expected: Backend starts without errors. Check logs for newsletter module registration.

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/newsletter/ backend/medusa-config.ts
git commit -m "feat(backend): add newsletter subscriber module with data model"
```

---

### Task 2: HMAC Token Utilities

**Files:**
- Create: `backend/src/utils/newsletter-token.ts`

- [ ] **Step 1: Create the token signing and verification helpers**

```typescript
// backend/src/utils/newsletter-token.ts
import { createHmac, timingSafeEqual } from "node:crypto"

const TOKEN_EXPIRY_SECONDS = 30 * 24 * 60 * 60 // 30 days

function getSecret(): string {
  const secret = process.env.NEWSLETTER_HMAC_SECRET
  if (!secret) {
    throw new Error("NEWSLETTER_HMAC_SECRET environment variable is required")
  }
  return secret
}

function hmac(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex")
}

function toBase64Url(str: string): string {
  return Buffer.from(str).toString("base64url")
}

function fromBase64Url(str: string): string {
  return Buffer.from(str, "base64url").toString("utf8")
}

export function signUnsubscribeToken(email: string): string {
  const encodedEmail = toBase64Url(email.toLowerCase())
  const expiry = Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_SECONDS
  const payload = `${encodedEmail}:${expiry}`
  const signature = hmac(payload)
  return `${payload}:${signature}`
}

export function verifyUnsubscribeToken(
  token: string
): { email: string } | null {
  const parts = token.split(":")
  if (parts.length !== 3) return null

  const [encodedEmail, expiryStr, providedHmac] = parts
  if (!encodedEmail || !expiryStr || !providedHmac) return null

  // Verify HMAC with constant-time comparison
  const payload = `${encodedEmail}:${expiryStr}`
  const expectedHmac = hmac(payload)

  const a = Buffer.from(providedHmac, "hex")
  const b = Buffer.from(expectedHmac, "hex")
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  // Check expiry
  const expiry = parseInt(expiryStr, 10)
  if (isNaN(expiry) || expiry <= Date.now() / 1000) return null

  // Decode email
  try {
    const email = fromBase64Url(encodedEmail)
    return { email }
  } catch {
    return null
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/utils/newsletter-token.ts
git commit -m "feat(backend): add HMAC token signing/verification for newsletter unsubscribe"
```

---

### Task 3: Zod Validators & Middleware Registration

**Files:**
- Create: `backend/src/api/store/newsletter/validators.ts`
- Modify: `backend/src/api/middlewares.ts`

- [ ] **Step 1: Create Zod validation schemas**

```typescript
// backend/src/api/store/newsletter/validators.ts
import { z } from "@medusajs/framework/zod"

export const SubscribeSchema = z.object({
  email: z.string().email(),
  source: z
    .enum(["footer", "checkout", "account", "import"])
    .default("footer"),
})

export const UnsubscribeSchema = z.object({
  token: z.string(),
})
```

- [ ] **Step 2: Register newsletter middleware in middlewares.ts**

Add these entries to the `routes` array in `backend/src/api/middlewares.ts`. Add the import at the top of the file:

```typescript
// Add to imports at top:
import {
  SubscribeSchema,
  UnsubscribeSchema,
} from "./store/newsletter/validators"
```

Add to the `routes` array (before the closing `]`):

```typescript
// --- Newsletter routes ---
{
  matcher: "/store/newsletter/subscribe",
  method: ["POST"],
  middlewares: [
    (req, _res, next) => {
      req.app.set("trust proxy", true)
      next()
    },
    authRateLimit(),
    authenticate("customer", ["session", "bearer"], {
      allowUnauthenticated: true,
    }),
    validateAndTransformBody(SubscribeSchema),
  ],
},
{
  matcher: "/store/newsletter/unsubscribe",
  method: ["POST"],
  middlewares: [
    validateAndTransformBody(UnsubscribeSchema),
  ],
},
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/api/store/newsletter/validators.ts backend/src/api/middlewares.ts
git commit -m "feat(backend): add newsletter route validators and middleware registration"
```

---

### Task 4: Subscribe Workflow & Step

**Files:**
- Create: `backend/src/workflows/newsletter/subscribe-to-newsletter.ts`

- [ ] **Step 1: Create the subscribe workflow**

This workflow handles normalize → upsert → customer_id backfill → emit event. Uses `createStep` inline since the logic is specific to this workflow.

```typescript
// backend/src/workflows/newsletter/subscribe-to-newsletter.ts
import {
  createWorkflow,
  createStep,
  StepResponse,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { emitEventStep } from "@medusajs/medusa/core-flows"
import { NEWSLETTER_MODULE } from "../../modules/newsletter"
import NewsletterModuleService from "../../modules/newsletter/service"

type SubscribeInput = {
  email: string
  source: "footer" | "checkout" | "account" | "import"
  customer_id?: string
}

const upsertSubscriberStep = createStep(
  "upsert-newsletter-subscriber",
  async (
    input: { email: string; source: string; customer_id?: string },
    { container }
  ) => {
    const newsletterService: NewsletterModuleService =
      container.resolve(NEWSLETTER_MODULE)

    const email = input.email.toLowerCase()

    // Check if subscriber already exists
    const [existing] = await newsletterService.listSubscribers(
      { email },
      { take: 1 }
    )

    if (existing) {
      let needsUpdate = false
      const updates: Record<string, unknown> = {}

      // Backfill customer_id if provided and missing
      if (input.customer_id && !existing.customer_id) {
        updates.customer_id = input.customer_id
        needsUpdate = true
      }

      // Reactivate if unsubscribed
      if (existing.status === "unsubscribed") {
        updates.status = "active"
        updates.unsubscribed_at = null
        needsUpdate = true
      }

      if (needsUpdate) {
        const updated = await newsletterService.updateSubscribers(
          existing.id,
          updates
        )
        return new StepResponse(
          { subscriber: updated, isNewSubscriber: false },
          existing.id
        )
      }

      return new StepResponse(
        { subscriber: existing, isNewSubscriber: false },
        existing.id
      )
    }

    // Create new subscriber
    const subscriber = await newsletterService.createSubscribers({
      email,
      source: input.source,
      customer_id: input.customer_id || null,
      status: "active",
    })

    return new StepResponse(
      { subscriber, isNewSubscriber: true },
      subscriber.id
    )
  }
  // No compensation — subscriber creation is idempotent
)

export const subscribeToNewsletterWorkflow = createWorkflow(
  "subscribe-to-newsletter",
  function (input: SubscribeInput) {
    const result = upsertSubscriberStep({
      email: input.email,
      source: input.source,
      customer_id: input.customer_id,
    })

    const eventData = transform({ result }, (data) => ({
      eventName: "newsletter.subscribed" as const,
      data: {
        id: data.result.subscriber.id,
        email: data.result.subscriber.email,
        isNewSubscriber: data.result.isNewSubscriber,
      },
    }))

    emitEventStep(eventData)

    return new WorkflowResponse(result)
  }
)
```

- [ ] **Step 2: Verify the backend compiles**

Run: `cd backend && bunx tsc --noEmit`

Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/workflows/newsletter/subscribe-to-newsletter.ts
git commit -m "feat(backend): add subscribe-to-newsletter workflow with upsert logic"
```

---

### Task 5: Unsubscribe Workflow

**Files:**
- Create: `backend/src/workflows/newsletter/unsubscribe-from-newsletter.ts`

- [ ] **Step 1: Create the unsubscribe workflow**

```typescript
// backend/src/workflows/newsletter/unsubscribe-from-newsletter.ts
import {
  createWorkflow,
  createStep,
  StepResponse,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { emitEventStep } from "@medusajs/medusa/core-flows"
import { NEWSLETTER_MODULE } from "../../modules/newsletter"
import NewsletterModuleService from "../../modules/newsletter/service"

type UnsubscribeInput = {
  email: string
}

const unsubscribeStep = createStep(
  "unsubscribe-newsletter",
  async (input: { email: string }, { container }) => {
    const newsletterService: NewsletterModuleService =
      container.resolve(NEWSLETTER_MODULE)

    const [subscriber] = await newsletterService.listSubscribers(
      { email: input.email.toLowerCase() },
      { take: 1 }
    )

    if (!subscriber) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "Subscriber not found"
      )
    }

    if (subscriber.status === "unsubscribed") {
      // Already unsubscribed — idempotent
      return new StepResponse(subscriber, null)
    }

    const previousStatus = subscriber.status

    const updated = await newsletterService.updateSubscribers(subscriber.id, {
      status: "unsubscribed",
      unsubscribed_at: new Date(),
    })

    return new StepResponse(updated, {
      id: subscriber.id,
      previousStatus,
    })
  },
  // Compensation: revert status
  async (compensationData, { container }) => {
    if (!compensationData) return

    const newsletterService: NewsletterModuleService =
      container.resolve(NEWSLETTER_MODULE)

    await newsletterService.updateSubscribers(compensationData.id, {
      status: compensationData.previousStatus,
      unsubscribed_at: null,
    })
  }
)

export const unsubscribeFromNewsletterWorkflow = createWorkflow(
  "unsubscribe-from-newsletter",
  function (input: UnsubscribeInput) {
    const subscriber = unsubscribeStep({ email: input.email })

    const eventData = transform({ subscriber, input }, (data) => ({
      eventName: "newsletter.unsubscribed" as const,
      data: {
        id: data.subscriber.id,
        email: data.input.email,
      },
    }))

    emitEventStep(eventData)

    return new WorkflowResponse(subscriber)
  }
)
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/workflows/newsletter/unsubscribe-from-newsletter.ts
git commit -m "feat(backend): add unsubscribe-from-newsletter workflow with compensation"
```

---

### Task 6: API Route Handlers

**Files:**
- Create: `backend/src/api/store/newsletter/subscribe/route.ts`
- Create: `backend/src/api/store/newsletter/unsubscribe/route.ts`

- [ ] **Step 1: Create the subscribe route handler**

```typescript
// backend/src/api/store/newsletter/subscribe/route.ts
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { subscribeToNewsletterWorkflow } from "../../../../workflows/newsletter/subscribe-to-newsletter"
import { SubscribeSchema } from "../validators"

type PostBody = z.infer<typeof SubscribeSchema>

export async function POST(
  req: MedusaRequest<PostBody>,
  res: MedusaResponse
) {
  const { email, source } = req.validatedBody

  const customerId = (req as any).auth_context?.actor_id as
    | string
    | undefined

  const { result } = await subscribeToNewsletterWorkflow(req.scope).run({
    input: {
      email,
      source,
      customer_id: customerId,
    },
  })

  res.status(result.isNewSubscriber ? 201 : 200).json({
    subscriber: result.subscriber,
    isNewSubscriber: result.isNewSubscriber,
  })
}
```

- [ ] **Step 2: Create the unsubscribe route handler**

```typescript
// backend/src/api/store/newsletter/unsubscribe/route.ts
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { verifyUnsubscribeToken } from "../../../../utils/newsletter-token"
import { unsubscribeFromNewsletterWorkflow } from "../../../../workflows/newsletter/unsubscribe-from-newsletter"
import { UnsubscribeSchema } from "../validators"

type PostBody = z.infer<typeof UnsubscribeSchema>

export async function POST(
  req: MedusaRequest<PostBody>,
  res: MedusaResponse
) {
  const { token } = req.validatedBody

  const result = verifyUnsubscribeToken(token)
  if (!result) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Invalid or expired unsubscribe token"
    )
  }

  await unsubscribeFromNewsletterWorkflow(req.scope).run({
    input: { email: result.email },
  })

  res.json({ success: true })
}
```

- [ ] **Step 3: Verify both routes are accessible**

Run: `cd backend && bun run dev`

Then test with curl:
```bash
# Subscribe (should work)
curl -X POST http://localhost:9000/store/newsletter/subscribe \
  -H "Content-Type: application/json" \
  -H "x-publishable-api-key: YOUR_KEY" \
  -d '{"email": "test@example.com", "source": "footer"}'

# Expected: 201 with { subscriber: {...}, isNewSubscriber: true }

# Subscribe again (idempotent)
curl -X POST http://localhost:9000/store/newsletter/subscribe \
  -H "Content-Type: application/json" \
  -H "x-publishable-api-key: YOUR_KEY" \
  -d '{"email": "test@example.com", "source": "footer"}'

# Expected: 200 with { subscriber: {...}, isNewSubscriber: false }
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/api/store/newsletter/
git commit -m "feat(backend): add newsletter subscribe and unsubscribe API routes"
```

---

### Task 7: Resend Audience Sync Workflows

**Files:**
- Create: `backend/src/workflows/newsletter/sync-newsletter-to-resend.ts`
- Create: `backend/src/workflows/newsletter/remove-newsletter-from-resend.ts`

- [ ] **Step 1: Create the sync workflow**

```typescript
// backend/src/workflows/newsletter/sync-newsletter-to-resend.ts
import {
  createWorkflow,
  createStep,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { Resend } from "resend"
import { NEWSLETTER_MODULE } from "../../modules/newsletter"
import NewsletterModuleService from "../../modules/newsletter/service"

type SyncInput = {
  email: string
  subscriber_id: string
}

const syncToResendStep = createStep(
  "sync-newsletter-to-resend",
  async (input: SyncInput, { container }) => {
    const audienceId = process.env.RESEND_AUDIENCE_ID
    const apiKey = process.env.RESEND_API_KEY

    if (!audienceId || !apiKey) {
      // Silently skip if not configured
      return new StepResponse({ skipped: true })
    }

    const resend = new Resend(apiKey)
    const logger = container.resolve("logger")

    const { data, error } = await resend.contacts.create({
      email: input.email,
      audienceId,
      unsubscribed: false,
    })

    if (error) {
      logger.warn(
        `[newsletter] Failed to sync ${input.email} to Resend Audience: ${error.message}`
      )
      return new StepResponse({ skipped: false, error: error.message })
    }

    // Store the Resend contact ID on the subscriber
    if (data?.id) {
      const newsletterService: NewsletterModuleService =
        container.resolve(NEWSLETTER_MODULE)

      await newsletterService.updateSubscribers(input.subscriber_id, {
        resend_contact_id: data.id,
      })
    }

    return new StepResponse({ skipped: false, contactId: data?.id })
  }
)

export const syncNewsletterToResendWorkflow = createWorkflow(
  "sync-newsletter-to-resend",
  function (input: SyncInput) {
    const result = syncToResendStep(input)
    return new WorkflowResponse(result)
  }
)
```

- [ ] **Step 2: Create the removal workflow**

```typescript
// backend/src/workflows/newsletter/remove-newsletter-from-resend.ts
import {
  createWorkflow,
  createStep,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { Resend } from "resend"
import { NEWSLETTER_MODULE } from "../../modules/newsletter"
import NewsletterModuleService from "../../modules/newsletter/service"

type RemoveInput = {
  email: string
  subscriber_id: string
}

const removeFromResendStep = createStep(
  "remove-newsletter-from-resend",
  async (input: RemoveInput, { container }) => {
    const audienceId = process.env.RESEND_AUDIENCE_ID
    const apiKey = process.env.RESEND_API_KEY

    if (!audienceId || !apiKey) {
      return new StepResponse({ skipped: true })
    }

    const newsletterService: NewsletterModuleService =
      container.resolve(NEWSLETTER_MODULE)

    const [subscriber] = await newsletterService.listSubscribers(
      { id: input.subscriber_id },
      { take: 1 }
    )

    if (!subscriber?.resend_contact_id) {
      return new StepResponse({ skipped: true })
    }

    const resend = new Resend(apiKey)
    const logger = container.resolve("logger")

    const { error } = await resend.contacts.remove({
      id: subscriber.resend_contact_id,
      audienceId,
    })

    if (error) {
      logger.warn(
        `[newsletter] Failed to remove ${input.email} from Resend Audience: ${error.message}`
      )
    }

    // Clear the contact ID regardless
    await newsletterService.updateSubscribers(input.subscriber_id, {
      resend_contact_id: null,
    })

    return new StepResponse({ skipped: false })
  }
)

export const removeNewsletterFromResendWorkflow = createWorkflow(
  "remove-newsletter-from-resend",
  function (input: RemoveInput) {
    const result = removeFromResendStep(input)
    return new WorkflowResponse(result)
  }
)
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/workflows/newsletter/sync-newsletter-to-resend.ts backend/src/workflows/newsletter/remove-newsletter-from-resend.ts
git commit -m "feat(backend): add Resend Audience sync and removal workflows"
```

---

### Task 8: Welcome Email Template & Registry

**Files:**
- Create: `backend/src/modules/resend/templates/newsletter-welcome.tsx`
- Modify: `backend/src/modules/resend/templates/template-registry.ts`
- Modify: `backend/src/modules/resend/service.ts`

- [ ] **Step 1: Create the welcome email template**

Follow the pattern from `welcome.tsx`. Read `backend/src/modules/resend/templates/welcome.tsx` for reference.

```tsx
// backend/src/modules/resend/templates/newsletter-welcome.tsx
import { Container, Html, Preview, Row, Section } from "@react-email/components"
import { Body } from "./_components/body"
import { Button } from "./_components/button"
import { LeftAligned as Footer } from "./_components/footer"
import { Head } from "./_components/head"
import { LeftAligned as Header } from "./_components/header"
import { Tailwind } from "./_components/tailwind"
import { Text } from "./_components/text"
import { getEmailConfig } from "./_config/email-config"
import type { BaseTemplateProps } from "./types"

export interface NewsletterWelcomeProps extends BaseTemplateProps {
  email: string
  unsubscribeUrl: string
}

export function isValidNewsletterWelcomeData(
  data: unknown
): data is NewsletterWelcomeProps {
  const d = data as Record<string, any>
  return typeof d?.email === "string" && typeof d?.unsubscribeUrl === "string"
}

export const NewsletterWelcome = ({
  theme,
  email,
  unsubscribeUrl,
  brandConfig,
}: NewsletterWelcomeProps) => {
  const config = getEmailConfig({
    ...brandConfig,
    legalLinks: {
      ...brandConfig?.legalLinks,
      unsubscribe: unsubscribeUrl,
    },
  })

  return (
    <Html>
      <Tailwind theme={theme}>
        <Head />
        <Preview>Welcome to the {config.companyName} newsletter</Preview>
        <Body>
          <Container
            align="center"
            className="w-full max-w-160 bg-primary md:p-8"
          >
            <Header logoUrl={config.logoUrl} logoAlt={config.logoAlt} />
            <Section align="left" className="max-w-full px-6 py-8">
              <Row className="mb-6">
                <Text className="text-display-xs font-semibold text-primary">
                  Welcome to Our Newsletter
                </Text>
              </Row>
              <Row className="mb-6">
                <Text className="text-tertiary">
                  Thanks for subscribing! We'll send you the latest deals and
                  savings weekly.
                </Text>
              </Row>
              <Row className="mb-6">
                <Button href={config.websiteUrl}>
                  <Text className="text-md font-semibold">Start Shopping</Text>
                </Button>
              </Row>
              <Row>
                <Text className="text-md text-tertiary">
                  If you have any questions, contact us at{" "}
                  <a
                    href={`mailto:${config.supportEmail}`}
                    className="text-brand-secondary"
                  >
                    {config.supportEmail}
                  </a>
                  .
                  <br />
                  <br />
                  Thanks,
                  <br />
                  The {config.companyName} team
                </Text>
              </Row>
            </Section>
            <Footer
              companyName={config.companyName}
              copyrightYear={config.copyrightYear}
              legalLinks={config.legalLinks}
            />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

NewsletterWelcome.PreviewProps = {
  email: "subscriber@example.com",
  unsubscribeUrl: "http://localhost:3000/newsletter/unsubscribe?token=test",
} satisfies NewsletterWelcomeProps

export default NewsletterWelcome
```

- [ ] **Step 2: Add to template registry**

In `backend/src/modules/resend/templates/template-registry.ts`, add:

```typescript
NEWSLETTER_WELCOME: "newsletter-welcome",
```

after `ABANDONED_CART: "abandoned-cart",`.

- [ ] **Step 3: Register in service.ts**

In `backend/src/modules/resend/service.ts`:

1. Add import at top:
```typescript
import { NewsletterWelcome, isValidNewsletterWelcomeData } from "./templates/newsletter-welcome"
```

2. Add to `templateRegistry` object after the abandoned cart entry:
```typescript
[EmailTemplates.NEWSLETTER_WELCOME]: {
  component: NewsletterWelcome,
  validate: isValidNewsletterWelcomeData,
  defaultSubject: "Welcome to Our Newsletter",
},
```

- [ ] **Step 4: Verify email preview**

Run: `cd backend && bun run dev`

Navigate to `http://localhost:3003` (email preview server). The "newsletter-welcome" template should appear and render correctly.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/resend/templates/newsletter-welcome.tsx backend/src/modules/resend/templates/template-registry.ts backend/src/modules/resend/service.ts
git commit -m "feat(backend): add newsletter welcome email template and registry"
```

---

### Task 9: Welcome Email Workflow

**Files:**
- Create: `backend/src/workflows/notifications/send-newsletter-welcome.ts`

- [ ] **Step 1: Create the welcome email workflow**

Follow the pattern from `send-order-confirmation.ts`. Read it for reference.

```typescript
// backend/src/workflows/notifications/send-newsletter-welcome.ts
import {
  createWorkflow,
  createStep,
  StepResponse,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { sendNotificationsStep } from "@medusajs/medusa/core-flows"
import { EmailTemplates } from "../../modules/resend/templates/template-registry"
import { signUnsubscribeToken } from "../../utils/newsletter-token"
import { resolveStorefrontUrl } from "../../subscribers/_helpers/resolve-urls"

type SendWelcomeInput = {
  email: string
  subscriber_id: string
}

const buildWelcomeNotificationStep = createStep(
  "build-newsletter-welcome-notification",
  async (input: SendWelcomeInput) => {
    const storefrontUrl = resolveStorefrontUrl()
    if (!storefrontUrl) {
      return new StepResponse(null)
    }

    const token = signUnsubscribeToken(input.email)
    const unsubscribeUrl = `${storefrontUrl}/newsletter/unsubscribe?token=${token}`

    return new StepResponse({
      to: input.email,
      channel: "email" as const,
      template: EmailTemplates.NEWSLETTER_WELCOME,
      data: {
        email: input.email,
        unsubscribeUrl,
      },
      trigger_type: "newsletter.subscribed",
      resource_id: input.subscriber_id,
      resource_type: "newsletter_subscriber",
    })
  }
)

export const sendNewsletterWelcomeWorkflow = createWorkflow(
  "send-newsletter-welcome",
  function (input: SendWelcomeInput) {
    const notification = buildWelcomeNotificationStep(input)

    const notifications = transform({ notification }, (data) => {
      if (!data.notification) return []
      return [data.notification]
    })

    sendNotificationsStep(notifications)

    return new WorkflowResponse({ sent: true })
  }
)
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/workflows/notifications/send-newsletter-welcome.ts
git commit -m "feat(backend): add send-newsletter-welcome workflow"
```

---

### Task 10: Event Subscribers

**Files:**
- Create: `backend/src/subscribers/newsletter-subscribed.ts`
- Create: `backend/src/subscribers/newsletter-unsubscribed.ts`

- [ ] **Step 1: Create the subscribe event handler**

Follow the pattern from `order-placed.ts`. Read it for reference.

```typescript
// backend/src/subscribers/newsletter-subscribed.ts
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { syncNewsletterToResendWorkflow } from "../workflows/newsletter/sync-newsletter-to-resend"
import { sendNewsletterWelcomeWorkflow } from "../workflows/notifications/send-newsletter-welcome"

type NewsletterSubscribedData = {
  id: string
  email: string
  isNewSubscriber: boolean
}

export default async function newsletterSubscribedHandler({
  event: { data },
  container,
}: SubscriberArgs<NewsletterSubscribedData>) {
  const logger = container.resolve("logger")

  // Always sync to Resend Audience
  try {
    await syncNewsletterToResendWorkflow(container).run({
      input: { email: data.email, subscriber_id: data.id },
    })
    logger.info(`[newsletter] Synced ${data.email} to Resend Audience`)
  } catch (error) {
    logger.warn(
      `[newsletter] Failed to sync ${data.email} to Resend: ${error}`
    )
  }

  // Send welcome email only for new subscribers
  if (data.isNewSubscriber) {
    try {
      await sendNewsletterWelcomeWorkflow(container).run({
        input: { email: data.email, subscriber_id: data.id },
      })
      logger.info(`[newsletter] Welcome email sent to ${data.email}`)
    } catch (error) {
      logger.warn(
        `[newsletter] Failed to send welcome email to ${data.email}: ${error}`
      )
    }
  }
}

export const config: SubscriberConfig = {
  event: "newsletter.subscribed",
}
```

- [ ] **Step 2: Create the unsubscribe event handler**

```typescript
// backend/src/subscribers/newsletter-unsubscribed.ts
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { removeNewsletterFromResendWorkflow } from "../workflows/newsletter/remove-newsletter-from-resend"

type NewsletterUnsubscribedData = {
  id: string
  email: string
}

export default async function newsletterUnsubscribedHandler({
  event: { data },
  container,
}: SubscriberArgs<NewsletterUnsubscribedData>) {
  const logger = container.resolve("logger")

  try {
    await removeNewsletterFromResendWorkflow(container).run({
      input: { email: data.email, subscriber_id: data.id },
    })
    logger.info(
      `[newsletter] Removed ${data.email} from Resend Audience`
    )
  } catch (error) {
    logger.warn(
      `[newsletter] Failed to remove ${data.email} from Resend: ${error}`
    )
  }
}

export const config: SubscriberConfig = {
  event: "newsletter.unsubscribed",
}
```

- [ ] **Step 3: Test the full backend flow**

Run: `cd backend && bun run dev`

Subscribe via curl and check the backend logs for:
1. Subscriber created in DB
2. `newsletter.subscribed` event emitted
3. Resend sync attempted (may skip if `RESEND_AUDIENCE_ID` not set)
4. Welcome email sent (if `RESEND_API_KEY` is set)

- [ ] **Step 4: Commit**

```bash
git add backend/src/subscribers/newsletter-subscribed.ts backend/src/subscribers/newsletter-unsubscribed.ts
git commit -m "feat(backend): add newsletter event subscribers for Resend sync and welcome email"
```

---

### Task 11: Storefront Server Action

**Files:**
- Create: `storefront/components/layout/footer/actions.ts`

- [ ] **Step 1: Create the server action**

Follow the pattern from `storefront/lib/medusa/wishlist.ts`. Read the first 50 lines for reference.

```typescript
// storefront/components/layout/footer/actions.ts
"use server"

import { sdk } from "lib/medusa"
import { getAuthHeaders } from "lib/medusa/cookies"
import { trackServer } from "lib/analytics-server"

export type NewsletterResult = {
  success?: boolean
  isNewSubscriber?: boolean
  error?: string
} | null

export async function subscribeToNewsletter(
  email: string
): Promise<NewsletterResult> {
  const headers = await getAuthHeaders()

  try {
    const { subscriber, isNewSubscriber } = await sdk.client.fetch<{
      subscriber: { id: string; email: string }
      isNewSubscriber: boolean
    }>("/store/newsletter/subscribe", {
      method: "POST",
      headers,
      body: {
        email: email.toLowerCase(),
        source: "footer" as const,
      },
    })

    await trackServer("newsletter_subscribed", {
      source: "footer",
      is_new_subscriber: isNewSubscriber,
    })

    return { success: true, isNewSubscriber }
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Subscription failed"

    await trackServer("newsletter_subscribe_failed", {
      source: "footer",
      error: errorMessage,
    }).catch(() => {})

    return { error: errorMessage }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add storefront/components/layout/footer/actions.ts
git commit -m "feat(storefront): add newsletter subscribe server action"
```

---

### Task 12: PostHog Analytics Events

**Files:**
- Modify: `storefront/lib/analytics.ts`

- [ ] **Step 1: Add newsletter events to the AnalyticsEvents type map**

In `storefront/lib/analytics.ts`, add the newsletter events after the existing event definitions (e.g., after the `abandoned_cart_recovered` event):

```typescript
// --- Newsletter ---
newsletter_subscribed: { source: "footer"; is_new_subscriber: boolean }
newsletter_subscribe_failed: { source: "footer"; error: string }
```

- [ ] **Step 2: Commit**

```bash
git add storefront/lib/analytics.ts
git commit -m "feat(storefront): add newsletter PostHog analytics events"
```

---

### Task 13: Footer Newsletter Form — Wire Up UI

**Files:**
- Modify: `storefront/components/layout/footer/footer-newsletter.tsx`
- Modify: `storefront/components/layout/footer/index.tsx`

- [ ] **Step 1: Update FooterNewsletter to a client component with form handling**

Replace the full contents of `storefront/components/layout/footer/footer-newsletter.tsx`:

```tsx
// storefront/components/layout/footer/footer-newsletter.tsx
"use client"

import { useActionState } from "react"
import { subscribeToNewsletter, type NewsletterResult } from "./actions"

export function FooterNewsletter({
  customerEmail,
}: {
  customerEmail?: string | null
}) {
  const [state, formAction, isPending] = useActionState<
    NewsletterResult,
    FormData
  >(async (_prev, formData) => {
    const email = formData.get("email") as string
    if (!email) return { error: "Email is required" }
    return subscribeToNewsletter(email)
  }, null)

  return (
    <div className="mt-12 md:col-span-8 md:col-start-3 md:row-start-2 md:mt-0 lg:col-span-4 lg:col-start-9 lg:row-start-1">
      <h3 className="text-sm font-medium text-gray-900">
        Sign up for our newsletter
      </h3>
      <p className="mt-6 text-sm text-gray-500">
        The latest deals and savings, sent to your inbox weekly.
      </p>

      {state?.success ? (
        <p className="mt-2 text-sm text-green-600">
          Thanks! Check your inbox.
        </p>
      ) : (
        <form action={formAction} className="mt-2 flex sm:max-w-md">
          <input
            id="email-address"
            name="email"
            type="email"
            required
            autoComplete="email"
            aria-label="Email address"
            defaultValue={customerEmail ?? ""}
            disabled={isPending}
            placeholder="Enter your email"
            className="block w-full rounded-md bg-white px-3 py-2 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 disabled:opacity-50 sm:text-sm/6"
          />
          <div className="ml-4 shrink-0">
            <button
              type="submit"
              disabled={isPending}
              className="bg-primary-600 hover:bg-primary-700 focus-visible:ring-primary-500 flex w-full items-center justify-center rounded-md border border-transparent px-4 py-2 text-base font-medium text-white shadow-xs focus:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50"
            >
              {isPending ? "..." : "Sign up"}
            </button>
          </div>
        </form>
      )}

      {state?.error && (
        <p className="mt-2 text-sm text-red-600">
          Something went wrong. Please try again.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Uncomment FooterNewsletter in the footer and pass customerEmail**

In `storefront/components/layout/footer/index.tsx`:

1. Add imports at the top:
```typescript
import { FooterNewsletter } from "./footer-newsletter"
import { retrieveCustomer } from "lib/medusa/customer"
```

2. Create an async wrapper component (inside the same file, above the `Footer` export) that fetches the customer email without blocking the rest of the footer:

```tsx
async function NewsletterWithCustomer() {
  const customer = await retrieveCustomer().catch(() => null)
  return <FooterNewsletter customerEmail={customer?.email} />
}
```

Keep `Footer` as a synchronous `function Footer()` (not async) — this avoids blocking the entire footer on the `retrieveCustomer()` call.

3. Replace the commented-out line `{/* <FooterNewsletter /> */}` with:
```tsx
<Suspense fallback={<FooterNewsletter />}>
  <NewsletterWithCustomer />
</Suspense>
```

This renders the newsletter form immediately (without pre-fill), then upgrades with the customer email once the async fetch resolves — matching the existing Suspense pattern for `FooterNavigation` and `FooterCopyright`.

- [ ] **Step 3: Verify the footer renders**

Run: `cd storefront && bun dev`

Navigate to `http://localhost:3000`. The footer should show the newsletter signup form. If logged in, email should be pre-filled.

- [ ] **Step 4: Commit**

```bash
git add storefront/components/layout/footer/footer-newsletter.tsx storefront/components/layout/footer/index.tsx
git commit -m "feat(storefront): wire up footer newsletter form with server action and pre-fill"
```

---

### Task 14: Unsubscribe Landing Page

**Files:**
- Create: `storefront/app/newsletter/unsubscribe/page.tsx`

- [ ] **Step 1: Create the unsubscribe page**

```tsx
// storefront/app/newsletter/unsubscribe/page.tsx
import { sdk } from "lib/medusa"

type Props = {
  searchParams: Promise<{ token?: string }>
}

export default async function UnsubscribePage({ searchParams }: Props) {
  const { token } = await searchParams

  if (!token) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Invalid Link</h1>
          <p className="mt-2 text-gray-500">
            This unsubscribe link is missing or malformed.
          </p>
        </div>
      </div>
    )
  }

  let success = false
  let errorMessage: string | null = null

  try {
    await sdk.client.fetch("/store/newsletter/unsubscribe", {
      method: "POST",
      body: { token },
    })
    success = true
  } catch (e) {
    errorMessage =
      e instanceof Error ? e.message : "Unable to process your request"
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        {success ? (
          <>
            <h1 className="text-2xl font-bold text-gray-900">
              You've been unsubscribed
            </h1>
            <p className="mt-2 text-gray-500">
              You won't receive any more newsletter emails from us.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900">
              Something went wrong
            </h1>
            <p className="mt-2 text-gray-500">
              {errorMessage?.includes("expired")
                ? "This unsubscribe link has expired. Please use the link in your most recent email."
                : "We couldn't process your request. Please try again or contact support."}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add storefront/app/newsletter/unsubscribe/page.tsx
git commit -m "feat(storefront): add newsletter unsubscribe landing page"
```

---

### Task 15: Environment Variables & Final Verification

**Files:**
- Modify: `backend/.env` (local only, not committed)

- [ ] **Step 1: Add required environment variables**

Add to `backend/.env` (do NOT commit):
```
NEWSLETTER_HMAC_SECRET=<generate a random 32+ char string>
# Optional — only needed if you want Resend Audience sync:
# RESEND_AUDIENCE_ID=<your Resend audience ID>
```

Generate a secret: `openssl rand -hex 32`

- [ ] **Step 2: Full end-to-end test**

1. Start both services: `bun run dev`
2. Navigate to `http://localhost:3000`
3. Scroll to footer — newsletter form should be visible
4. Enter an email and click "Sign up"
5. Form should show "Thanks! Check your inbox."
6. Check backend logs for `[newsletter]` entries
7. If Resend is configured, check your inbox for the welcome email
8. Submit the same email again — should show success (idempotent)

- [ ] **Step 3: Test unsubscribe flow**

1. If you received a welcome email, click the unsubscribe link
2. Should redirect to `/newsletter/unsubscribe?token=...`
3. Page should show "You've been unsubscribed"
4. Backend logs should show `[newsletter] Removed ... from Resend Audience`

- [ ] **Step 4: Final commit (if any env or config tweaks were needed)**

Only commit code changes, not `.env` files.
