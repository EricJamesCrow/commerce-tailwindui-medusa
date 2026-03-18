# Abandoned Cart Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send a single automated recovery email to customers who abandon carts with items, including an HMAC-signed link to restore their cart session.

**Architecture:** Medusa scheduled job (every 15 min) queries for abandoned carts (1–48 hour window), invokes a workflow per cart that generates an HMAC recovery token, formats the cart data, sends via Resend, and flags the cart metadata. A storefront Route Handler verifies the token and restores the cart cookie.

**Tech Stack:** Medusa v2 scheduled jobs, workflows, query.graph(), core-flows (updateCartsStep, sendNotificationsStep), Node.js crypto (HMAC-SHA256), React Email + Resend, Next.js 16 Route Handlers

**Spec:** `docs/superpowers/specs/2026-03-18-abandoned-cart-recovery-design.md`

**Git workflow:** Per CLAUDE.md, use Graphite CLI (`gt`) for branching and PRs. Before starting Task 1, create the feature branch with `gt create -m "feat(email): abandoned cart recovery"`. After all tasks are complete, push via `gt submit --stack`. Local commits throughout the plan use standard `git commit`.

---

## File Map

### New files

| File | Responsibility |
|------|---------------|
| `backend/src/workflows/steps/generate-cart-recovery-token.ts` | HMAC-SHA256 token generation step |
| `backend/src/workflows/steps/format-cart-for-email.ts` | Cart → email data transform step |
| `backend/src/workflows/notifications/send-abandoned-cart-email.ts` | Workflow orchestrating the full send flow |
| `backend/src/jobs/send-abandoned-cart-emails.ts` | Scheduled job (every 15 min) |
| `backend/src/modules/resend/templates/abandoned-cart.tsx` | React Email template |
| `storefront/app/cart/recover/[id]/route.ts` | Recovery link verification + cart restore |

### Modified files

| File | Change |
|------|--------|
| `backend/src/modules/resend/service.ts:38-47` | Add `"abandoned-cart"` to template map |

---

## Task 1: HMAC Token Generation Step

**Files:**
- Create: `backend/src/workflows/steps/generate-cart-recovery-token.ts`

- [ ] **Step 1: Create the token generation step**

```typescript
// backend/src/workflows/steps/generate-cart-recovery-token.ts
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { createHmac } from "node:crypto"
import { resolveStorefrontUrl } from "../../subscribers/_helpers/resolve-urls"

type GenerateCartRecoveryTokenInput = {
  cart_id: string
}

type GenerateCartRecoveryTokenOutput = {
  token: string
  recoveryUrl: string
}

export const generateCartRecoveryTokenStep = createStep(
  "generate-cart-recovery-token",
  async (input: GenerateCartRecoveryTokenInput): Promise<StepResponse<GenerateCartRecoveryTokenOutput>> => {
    const secret = process.env.CART_RECOVERY_SECRET
    if (!secret) {
      throw new Error(
        "CART_RECOVERY_SECRET env var is required for abandoned cart recovery"
      )
    }

    const token = createHmac("sha256", secret)
      .update(input.cart_id)
      .digest("hex")

    const storefrontUrl = resolveStorefrontUrl() || "http://localhost:3000"
    const recoveryUrl = `${storefrontUrl}/cart/recover/${input.cart_id}?token=${token}`

    return new StepResponse({ token, recoveryUrl })
  }
  // No rollback — token generation is pure computation with no side effects
)
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd backend && npx tsc --noEmit src/workflows/steps/generate-cart-recovery-token.ts 2>&1 | head -20`
Expected: No errors (or only unrelated ambient errors)

- [ ] **Step 3: Commit**

```bash
git add backend/src/workflows/steps/generate-cart-recovery-token.ts
git commit -m "feat(email): add HMAC token generation step for cart recovery"
```

---

## Task 2: Cart Format Step

**Files:**
- Create: `backend/src/workflows/steps/format-cart-for-email.ts`

- [ ] **Step 1: Create the cart format step**

```typescript
// backend/src/workflows/steps/format-cart-for-email.ts
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  createCurrencyFormatter,
  formatItem,
} from "../notifications/_format-helpers"

export type AbandonedCartEmailData = {
  subject: string
  customerName?: string
  items: {
    name: string
    variant?: string
    quantity: number
    price: string
    imageUrl?: string
  }[]
  subtotal: string
  recoveryUrl: string
  currencyCode: string
}

type FormatCartForEmailInput = {
  cart: Record<string, any>
  recoveryUrl: string
}

export const formatCartForEmailStep = createStep(
  "format-cart-for-email",
  async (input: FormatCartForEmailInput): Promise<StepResponse<AbandonedCartEmailData>> => {
    const { cart, recoveryUrl } = input

    const fmt = createCurrencyFormatter(cart.currency_code || "USD")
    const formatMoney = (amount: number) => fmt.format(amount)

    const items = ((cart.items || []) as Record<string, any>[]).map((item) =>
      formatItem(item, formatMoney)
    )

    const formatted: AbandonedCartEmailData = {
      subject: "You left something behind!",
      customerName: cart.customer?.first_name || undefined,
      items,
      subtotal: formatMoney(cart.item_subtotal ?? 0),
      recoveryUrl,
      currencyCode: cart.currency_code || "USD",
    }

    return new StepResponse(formatted)
  }
  // No rollback — pure data transformation
)
```

**Note on `formatItem` compatibility:** The existing helper uses `item.total ?? item.unit_price * item.quantity`. Cart line items should have `item_subtotal` or `unit_price`. If `item.total` is undefined on cart items, the fallback (`unit_price * quantity`) produces the correct pre-tax amount. Verify during testing.

- [ ] **Step 2: Verify the file compiles**

Run: `cd backend && npx tsc --noEmit src/workflows/steps/format-cart-for-email.ts 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/workflows/steps/format-cart-for-email.ts
git commit -m "feat(email): add cart format step for abandoned cart emails"
```

---

## Task 3: Abandoned Cart Email Workflow

**Files:**
- Create: `backend/src/workflows/notifications/send-abandoned-cart-email.ts`

- [ ] **Step 1: Create the workflow**

```typescript
// backend/src/workflows/notifications/send-abandoned-cart-email.ts
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import {
  useQueryGraphStep,
  sendNotificationsStep,
  updateCartsStep,
} from "@medusajs/medusa/core-flows"
import { generateCartRecoveryTokenStep } from "../steps/generate-cart-recovery-token"
import { formatCartForEmailStep } from "../steps/format-cart-for-email"

type SendAbandonedCartEmailInput = {
  cart_id: string
  email: string
}

export const sendAbandonedCartEmailWorkflow = createWorkflow(
  "send-abandoned-cart-email",
  function (input: SendAbandonedCartEmailInput) {
    // Step 1: Fetch full cart data
    const { data: carts } = useQueryGraphStep({
      entity: "cart",
      fields: [
        "id",
        "email",
        "currency_code",
        "items.*",
        "items.variant.*",
        "items.variant.product.*",
        "metadata",
        "customer.first_name",
        "item_subtotal",
      ],
      filters: { id: input.cart_id },
    })

    // Unwrap array result to single cart
    const cart = transform({ carts }, ({ carts: result }) => {
      const c = result[0]
      if (!c?.email) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Cart has no email address, cannot send abandoned cart notification"
        )
      }
      return c
    })

    // Step 2: Generate HMAC recovery token
    const recoveryToken = generateCartRecoveryTokenStep({
      cart_id: input.cart_id,
    })

    // Wire recovery URL into format step input
    const formatInput = transform(
      { cart, recoveryToken },
      ({ cart: c, recoveryToken: rt }) => ({
        cart: c,
        recoveryUrl: rt.recoveryUrl,
      })
    )

    // Step 3: Format cart data for email
    const formatted = formatCartForEmailStep(formatInput)

    // Prepare notification input (data manipulation inside transform)
    const notifications = transform(
      { formatted, cart },
      ({ formatted: data, cart: c }) => [
        {
          to: (c.email as string).toLowerCase(),
          channel: "email" as const,
          template: "abandoned-cart",
          data,
          trigger_type: "cart.abandoned",
          resource_id: c.id as string,
          resource_type: "cart",
        },
      ]
    )

    // Step 4: Send via Resend
    sendNotificationsStep(notifications)

    // Prepare cart metadata update (data manipulation inside transform)
    const cartUpdate = transform({ cart }, ({ cart: c }) => [
      {
        id: c.id as string,
        metadata: {
          ...((c.metadata as Record<string, unknown>) || {}),
          abandoned_cart_notified: new Date().toISOString(),
        },
      },
    ])

    // Step 5: Flag cart as notified
    updateCartsStep(cartUpdate)

    return new WorkflowResponse({ cart_id: input.cart_id })
  }
)
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd backend && npx tsc --noEmit src/workflows/notifications/send-abandoned-cart-email.ts 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/workflows/notifications/send-abandoned-cart-email.ts
git commit -m "feat(email): add abandoned cart email workflow"
```

---

## Task 4: Abandoned Cart Email Template

**Files:**
- Create: `backend/src/modules/resend/templates/abandoned-cart.tsx`
- Modify: `backend/src/modules/resend/service.ts:38-47`

- [ ] **Step 1: Create the email template**

Follow the pattern from `order-confirmation.tsx`. Simpler layout — no order summary, no address blocks. Just greeting, item table, subtotal, CTA button.

```tsx
// backend/src/modules/resend/templates/abandoned-cart.tsx
import { Container, Html, Preview, Row, Section } from "@react-email/components";
import { Body } from "./_components/body";
import { Button } from "./_components/button";
import { LeftAligned as Footer } from "./_components/footer";
import { Head } from "./_components/head";
import { LeftAligned as Header } from "./_components/header";
import { Tailwind } from "./_components/tailwind";
import { Text } from "./_components/text";
import { ItemTable } from "./_commerce/item-table";
import { getEmailConfig } from "./_config/email-config";
import type { CommerceLineItem, BaseTemplateProps } from "./types";

export interface AbandonedCartProps extends BaseTemplateProps {
  customerName?: string;
  items: CommerceLineItem[];
  subtotal: string;
  recoveryUrl: string;
  currencyCode?: string;
}

export const AbandonedCart = ({
  theme,
  customerName,
  items,
  subtotal,
  recoveryUrl,
  brandConfig,
}: AbandonedCartProps) => {
  const config = getEmailConfig(brandConfig);
  const greeting = customerName ? `Hi ${customerName},` : "Hi there,";

  return (
    <Html>
      <Tailwind theme={theme}>
        <Head />
        <Preview>You left items in your cart - {subtotal}</Preview>
        <Body>
          <Container align="center" className="w-full max-w-160 bg-primary md:p-8">
            <Header logoUrl={config.logoUrl} logoAlt={config.logoAlt} />
            <Section align="left" className="max-w-full px-6 py-8">
              <Row className="mb-6">
                <Text className="text-display-xs font-semibold text-primary">
                  You Left Something Behind
                </Text>
              </Row>
              <Row className="mb-6">
                <Text className="text-tertiary">
                  {greeting}
                  <br />
                  <br />
                  We noticed you left some items in your cart. They're still
                  waiting for you — come back and complete your purchase.
                </Text>
              </Row>

              <ItemTable items={items} />

              <Row className="mb-2 mt-4 border-t border-solid border-secondary pt-4">
                <Text className="m-0 text-sm font-semibold text-primary">
                  Subtotal: {subtotal}
                </Text>
              </Row>

              <Row className="mt-6 mb-6">
                <Button href={recoveryUrl}>
                  <Text className="text-md font-semibold">Return to your cart</Text>
                </Button>
              </Row>

              <Row>
                <Text className="text-md text-tertiary">
                  If you've already completed your purchase, please ignore
                  this email.
                  <br />
                  <br />
                  Questions? Contact us at{" "}
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
  );
};

AbandonedCart.PreviewProps = {
  customerName: "Sarah",
  items: [
    { name: "Leather Crossbody Bag", variant: "Tan / One Size", quantity: 1, price: "$128.00" },
    { name: "Merino Wool Scarf", variant: "Charcoal", quantity: 2, price: "$98.00" },
  ],
  subtotal: "$226.00",
  recoveryUrl: "http://localhost:3000/cart/recover/cart_01ABC?token=abc123",
  currencyCode: "USD",
} satisfies AbandonedCartProps;

export default AbandonedCart;
```

- [ ] **Step 2: Register the template in the Resend service**

In `backend/src/modules/resend/service.ts`, add the import and template map entry:

Add import at top (after line 19):
```typescript
import { AbandonedCart } from "./templates/abandoned-cart"
```

Add to the `templates` object (after line 46, the `"admin-order-alert"` entry):
```typescript
    "abandoned-cart": AbandonedCart,
```

- [ ] **Step 3: Verify the file compiles**

Run: `cd backend && npx tsc --noEmit src/modules/resend/service.ts 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/resend/templates/abandoned-cart.tsx backend/src/modules/resend/service.ts
git commit -m "feat(email): add abandoned cart email template and register in Resend"
```

---

## Task 5: Scheduled Job

**Files:**
- Create: `backend/src/jobs/send-abandoned-cart-emails.ts`

- [ ] **Step 1: Create the scheduled job**

```typescript
// backend/src/jobs/send-abandoned-cart-emails.ts
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { sendAbandonedCartEmailWorkflow } from "../workflows/notifications/send-abandoned-cart-email"

export default async function abandonedCartJob(
  container: MedusaContainer
) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve("logger")

  const startTime = Date.now()
  const limit = 100
  let offset = 0
  let totalCount = 0
  let totalSent = 0
  let totalErrors = 0

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000)

  logger.info("Starting abandoned cart email job...")

  try {
    do {
      const { data: carts, metadata: paginationMeta } = await query.graph({
        entity: "cart",
        fields: [
          "id",
          "email",
          "items.*",
          "metadata",
          "updated_at",
        ],
        filters: {
          completed_at: null,
          updated_at: {
            $lt: oneHourAgo,
            $gt: fortyEightHoursAgo,
          },
          email: { $ne: null },
        },
        pagination: { skip: offset, take: limit },
      })

      totalCount = (paginationMeta as any)?.count ?? 0

      // JS filter: items check and dedup flag can't be expressed in query.graph()
      const eligibleCarts = carts.filter(
        (cart: any) =>
          cart.items?.length > 0 &&
          !(cart.metadata as any)?.abandoned_cart_notified
      )

      for (const cart of eligibleCarts) {
        try {
          await sendAbandonedCartEmailWorkflow(container).run({
            input: {
              cart_id: (cart as any).id,
              email: ((cart as any).email as string).toLowerCase(),
            },
          })
          totalSent++
          logger.info(`Sent abandoned cart email for cart ${(cart as any).id}`)
        } catch (error: any) {
          totalErrors++
          logger.error(
            `Failed to send abandoned cart email for cart ${(cart as any).id}: ${error?.message}`
          )
        }
      }

      offset += limit
    } while (offset < totalCount)

    const duration = Date.now() - startTime
    logger.info(
      `Abandoned cart job complete: ${totalSent} sent, ${totalErrors} errors in ${duration}ms`
    )
  } catch (error: any) {
    logger.error(`Abandoned cart job failed: ${error?.message}`)
  }
}

export const config = {
  name: "send-abandoned-cart-emails",
  schedule: "*/15 * * * *", // Every 15 minutes
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd backend && npx tsc --noEmit src/jobs/send-abandoned-cart-emails.ts 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/jobs/send-abandoned-cart-emails.ts
git commit -m "feat(email): add abandoned cart scheduled job (every 15 min)"
```

---

## Task 6: Full Backend Build Verification

- [ ] **Step 1: Run full backend build**

Run: `cd backend && bun run build 2>&1 | tail -30`
Expected: Build succeeds with no errors

- [ ] **Step 2: Fix any build errors**

If there are type errors or import issues, fix them and re-run the build.

- [ ] **Step 3: Commit any fixes**

```bash
git add -p  # Stage only the fixes
git commit -m "fix(email): resolve build errors in abandoned cart backend"
```

---

## Task 7: Cart Recovery Route (Storefront)

**Files:**
- Create: `storefront/app/cart/recover/[id]/route.ts`

- [ ] **Step 1: Create the recovery route handler**

```typescript
// storefront/app/cart/recover/[id]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createHmac, timingSafeEqual } from "node:crypto"
import { setCartId } from "lib/medusa/cookies"
import sdk from "lib/medusa"

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const token = request.nextUrl.searchParams.get("token")

  // Validate required params
  if (!id || !token) {
    return new NextResponse(null, { status: 404 })
  }

  // Verify HMAC token
  const secret = process.env.CART_RECOVERY_SECRET
  if (!secret) {
    console.error("CART_RECOVERY_SECRET is not set")
    return new NextResponse(null, { status: 404 })
  }

  const expectedToken = createHmac("sha256", secret)
    .update(id)
    .digest("hex")

  // Timing-safe comparison to prevent timing attacks
  let isValid = false
  try {
    isValid = timingSafeEqual(
      Buffer.from(token, "hex"),
      Buffer.from(expectedToken, "hex")
    )
  } catch {
    // Buffer lengths don't match — invalid token
    isValid = false
  }

  if (!isValid) {
    return new NextResponse(null, { status: 404 })
  }

  // Verify the cart still exists and isn't completed
  try {
    const { cart } = await sdk.store.cart.retrieve(id)
    if (!cart || cart.completed_at) {
      // Cart was already converted to an order or deleted
      return NextResponse.redirect(new URL("/", request.url))
    }
  } catch {
    // Cart not found
    return NextResponse.redirect(new URL("/", request.url))
  }

  // Token is valid, cart exists — restore the cart session
  await setCartId(id)

  // Redirect to homepage — the cart is a drawer (no /cart page exists).
  // The spec says redirect("/cart") but this storefront uses a cart drawer,
  // so we redirect to "/" where the cart icon is accessible.
  return NextResponse.redirect(new URL("/", request.url))
}
```

**Spec deviation note:** The spec says `redirect("/cart")` but this storefront has no `/cart` page — the cart is a sliding drawer accessible from any page. Redirecting to `/` lands the user on the homepage with their recovered cart available via the cart icon. This is the correct behavior for this storefront architecture.

- [ ] **Step 2: Verify the storefront builds**

Run: `cd storefront && bun run build 2>&1 | tail -30`
Expected: Build succeeds. The route is compiled as a Route Handler.

- [ ] **Step 3: Commit**

```bash
git add storefront/app/cart/recover/[id]/route.ts
git commit -m "feat(storefront): add cart recovery route with HMAC verification"
```

---

## Task 8: Environment Variable Setup

- [ ] **Step 1: Generate a recovery secret and add to backend `.env`**

Run: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` to generate a secret.

Add to `backend/.env`:
```
CART_RECOVERY_SECRET=<generated-secret>
```

- [ ] **Step 2: Add the same secret to storefront `.env.local`**

Add to `storefront/.env.local`:
```
CART_RECOVERY_SECRET=<same-secret-as-backend>
```

**Important:** Do NOT use a `NEXT_PUBLIC_` prefix — this is a server-side-only secret.

- [ ] **Step 3: Verify both apps start without errors**

Run (from root): `bun run dev`
Expected: Both backend and storefront start successfully. Backend logs should show the scheduled job registered.

---

## Task 9: Manual End-to-End Test

- [ ] **Step 1: Create an abandoned cart for testing**

1. Open the storefront at `http://localhost:3000`
2. Add items to cart
3. In the cart drawer, note the cart (you can check `_medusa_cart_id` cookie in browser dev tools)
4. Don't complete checkout

- [ ] **Step 2: Manually trigger the job for testing**

Temporarily change the job schedule to `"* * * * *"` (every minute) and the time window to a shorter threshold for testing:

In `backend/src/jobs/send-abandoned-cart-emails.ts`, temporarily change:
```typescript
const oneHourAgo = new Date(Date.now() - 2 * 60 * 1000) // 2 minutes for testing
```
And:
```typescript
schedule: "* * * * *", // Every minute for testing
```

Restart the backend and wait for the job to fire.

- [ ] **Step 3: Verify email was sent**

Check the backend terminal logs for:
```
info: Starting abandoned cart email job...
info: Sent abandoned cart email for cart cart_XXXXX
info: Abandoned cart job complete: 1 sent, 0 errors in Xms
```

If using Resend with a verified domain, check the recipient inbox. If using `onboarding@resend.dev`, check the Resend dashboard for sent emails.

- [ ] **Step 4: Test the recovery link**

1. Copy the recovery URL from the email (or construct it: `http://localhost:3000/cart/recover/<cart_id>?token=<token>`)
2. Open it in a new browser/incognito window
3. Verify: redirected to `/`, cart icon shows items, cart drawer shows the recovered cart

- [ ] **Step 5: Verify idempotency**

Wait for the job to run again. Check logs — the same cart should NOT be emailed again (metadata flag prevents it).

- [ ] **Step 6: Revert test changes and commit**

Revert the temporary schedule/threshold changes in `send-abandoned-cart-emails.ts` back to:
```typescript
const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
schedule: "*/15 * * * *",
```

```bash
git add backend/src/jobs/send-abandoned-cart-emails.ts
git commit -m "test: verify abandoned cart recovery e2e, revert test config"
```

---

## Task 10: Update TODO.md

- [ ] **Step 1: Mark the abandoned cart item as complete**

In `TODO.md`, change:
```markdown
- [ ] Abandoned cart recovery emails (Resend)
```
to:
```markdown
- [x] Abandoned cart recovery emails (scheduled job every 15 min, HMAC-signed recovery links, Resend)
```

- [ ] **Step 2: Commit**

```bash
git add TODO.md
git commit -m "docs: mark abandoned cart recovery as complete in TODO"
```
