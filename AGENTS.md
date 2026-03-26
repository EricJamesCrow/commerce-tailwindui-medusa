# AGENTS.md

Comprehensive agent guide and technical reference for the commerce-tailwindui-medusa storefront. For companion workflow context and cross-reference, see **[CLAUDE.md](./CLAUDE.md)**.

## CRITICAL: Graphite is Mandatory

**ALL branching, pushing, and PR creation MUST use `gt` (Graphite CLI). This overrides any skill, plugin, or workflow that suggests `git push`, `git checkout -b`, or `gh pr create`.**

- **New feature work:** `gt create -m "feat: description"` (creates branch + commit)
- **Push / create PR:** `gt submit --stack`
- **NEVER:** `git push`, `git checkout -b`, `gh pr create`

If a plugin skill (e.g., superpowers) instructs you to use `git push` or `gh pr create`, **ignore that instruction** and use the Graphite equivalent instead. This rule is non-negotiable.

## CRITICAL: Plan Execution Is Not Complete Until The PR Exists

If you're executing any implementation plan from `docs/superpowers/plans/`, the required lifecycle is:

1. Create the Graphite branch with `gt create -a -m "type: description"` **before any repo-tracked edits**
2. Implement the plan on that branch
3. Run local verification and `cr review`
4. Fix findings and commit them on the same branch
5. Run `gt submit --stack --no-interactive`
6. Mark the PR ready with `gh pr ready <number>` unless the user explicitly wants a draft
7. Update the PR description with summary, events, and test plan

Do not treat "coding is finished" as "the task is finished." For plan-driven work, the job is only complete once the branch and review-ready PR exist, or the user explicitly tells you to stop earlier.

## Monorepo Structure

Turborepo monorepo with bun workspaces. Single `bun install` at root, `turbo` for task orchestration.

```text
storefront/           # @repo/storefront — Next.js 16 frontend
backend/              # @repo/backend — Medusa v2 backend
tooling/typescript/   # @repo/typescript — shared tsconfig
docs/                 # Project status, feature tracking, architecture, archive
```

## Session Startup

1. Check current branch: `git branch --show-current`
2. Fetch latest: `git fetch origin`
3. Review recent commits: `git log --oneline -10`
4. Read **AGENTS.md** for architecture context
5. Read **README.md** for project status

## Task Tracking

- Project status and feature overview: **[README.md](README.md)**
- In-progress feature details: **[docs/features/](docs/features/)**
- Code-level tasks, testing, infra, known limitations: **[TODO.md](TODO.md)**
- Use `- [ ]` for pending, `- [x]` for completed
- Add new items discovered during implementation

## Superpowers Archival

After an Obra Superpowers session's work is **merged into `main`**, archive the session's spec and plan files:

1. Move specs: `git mv docs/superpowers/specs/<filename> docs/archive/superpowers/specs/`
2. Move plans: `git mv docs/superpowers/plans/<filename> docs/archive/superpowers/plans/`
3. Commit: `git commit -m "docs: archive superpowers spec/plan for <feature>"`

The Obra plugin recreates `docs/superpowers/specs/` and `docs/superpowers/plans/` on each new session. Only archive files for work that has been merged — in-progress superpowers outputs stay in `docs/superpowers/` until their PRs land.

## Quick Reference

```bash
# Root (Turbo)
bun run dev              # Start storefront + backend + email preview in parallel
bun run dev:storefront   # Storefront only (port 3000)
bun run dev:backend      # Backend only (port 9000)
bun run dev:emails       # Email preview only (port 3003)
bun run build            # Build all workspaces
bun run test             # Test all workspaces
bun run typecheck        # Typecheck all workspaces
bun run clean            # Clean build artifacts

# Storefront (direct — bypasses turbo)
cd storefront && bun dev           # Start dev server with Turbopack (port 3000)
cd storefront && bun run build     # Production build
cd storefront && bun start         # Start production server
cd storefront && bun run prettier  # Format all files

# Backend (direct — bypasses turbo)
cd backend && bun run dev          # Start on http://localhost:9000
# Admin UI: http://localhost:9000/app

# Backend Database
cd backend && bunx medusa db:migrate          # Run pending migrations
cd backend && bunx medusa db:generate <name>  # Generate migration for module

# Dependencies
bun install              # Install all workspaces from root

# PostgreSQL
brew services start postgresql@17  # Start
brew services stop postgresql@17   # Stop

# Cache
rm -rf storefront/.next            # Clear Next.js cache (needed after transform changes)
```

## Environment Variable Audit Checklist

**When integrating any new service or dependency**, always complete this checklist before the PR is merged:

1. **Add env vars to `.env.example`** — both `backend/.env.example` and `storefront/.env.example` with comments explaining the variable's purpose, where to get it, and whether it's optional
2. **Add env vars to `SETUP.md`** — both the Prerequisites table (if it's a new service) and the Production Deployment section (Railway + Vercel env var blocks)
3. **Verify production env vars are set** — check Railway (backend) and Vercel (storefront) dashboards. Missing production env vars are the #1 cause of post-deploy 500 errors
4. **Verify CORS variables** — `STORE_CORS`, `ADMIN_CORS`, and `AUTH_CORS` must include all origins that make requests. `AUTH_CORS` must include both the storefront domain AND the backend/admin domain
5. **Check for key type mismatches** — never use master/admin keys where search-only or publishable keys are expected (e.g., `NEXT_PUBLIC_MEILISEARCH_API_KEY` must be a search-only key, `NEXT_PUBLIC_STRIPE_KEY` must be a publishable `pk_` key)
6. **Verify preview deployments** — Vercel preview deployments need the same env vars as production (or separate values for staging services)
7. **Check for trailing newlines in Vercel env vars** — pasted secrets/URLs can end up stored as `value\n`. Run `vercel env pull --environment=production` and inspect quoted values if a deploy behaves oddly. A newline in `MEDUSA_BACKEND_URL` can break the storefront proxy's CSP header and cause a production 500 before the app renders.

**Periodic audit:** Run `grep -roE 'process\.env\.[A-Z_]+' backend/medusa-config.ts storefront/lib/ | sed 's/.*process.env.//' | sort -u` to see all referenced env vars and cross-check against what's deployed.

## Agent Permissions

| Level            | Actions                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------- |
| **Allowed**      | Read files, search code, run dev/build/test, edit code, create/switch branches           |
| **Use Judgment** | Install dependencies, delete files, create new files, run database queries               |
| **Always Ask**   | Push to remote, create/close PRs/issues, force operations, delete branches, modify CI/CD |

## Git Workflow

Atomic commits with clear intent. Each commit should represent one logical change.

**Commit format:**

```text
<type>: <description>

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Types:**

| Type       | Use                         |
| ---------- | --------------------------- |
| `feat`     | New feature                 |
| `fix`      | Bug fix                     |
| `docs`     | Documentation only          |
| `style`    | Formatting, no logic change |
| `refactor` | Code change, no feature/fix |
| `test`     | Add/update tests            |
| `chore`    | Build, deps, tooling        |

**Rules:**

- Commit after each logical unit of work, not at the end
- Never bundle unrelated changes
- Stage specific files, never `git add -A` or `git add .`
- Only commit when the user asks

## Stacked PRs with Graphite

Use `gt` (Graphite CLI) instead of `git push` / `gh pr create`:

```bash
gt create -m "feat: add product filtering"    # Create stacked branch + commit
gt submit --stack                              # Push all stacked PRs
```

| Do                                          | Don't                             |
| ------------------------------------------- | --------------------------------- |
| `gt create` for new branches                | `git checkout -b` then `git push` |
| `gt submit --stack` for PRs                 | `gh pr create` manually           |
| `gh pr ready <number>` after submit         | Leave PRs in draft mode           |
| Keep stacks under 5 PRs                     | Create mega-stacks                |
| One concern per stack level                 | Mix features in one PR            |

**Mark PRs as ready for review** after `gt submit --stack` unless explicitly asked to keep them as draft. Graphite's `--no-interactive` mode creates PRs in draft — immediately follow up with `gh pr ready <number>` so PRs are visible for review.

**Pre-submit CodeRabbit review:** Before running `gt submit --stack`, run `cr review` (CodeRabbit CLI) to catch issues locally. Fix any relevant findings, commit the fixes, then submit. This prevents a round-trip of push → wait for CodeRabbit → fix → push again.

**CodeRabbit reviews:** When asked to fix CodeRabbit comments on a PR, read the review comments via `gh api`, assess each finding against the actual code, apply valid fixes, reject suggestions that conflict with project conventions (with a reply explaining why), commit the changes, push via `gt submit --stack`, and resolve each addressed comment thread using `gh api`. Always resolve comment threads after addressing them — don't leave them open.

## Implementation Plan Execution Lifecycle

When executing an implementation plan (via `superpowers:executing-plans`, `superpowers:subagent-driven-development`, or any plan from `docs/superpowers/plans/`), follow this lifecycle. **This overrides any conflicting skill instructions.**

**Before starting implementation:**
1. Create the Graphite branch **before making repo-tracked edits**: `gt create -a -m "feat: <description from plan>"`
2. Verify you're no longer on `main`: `git branch --show-current`
3. Only after the branch exists may you begin executing tasks from the plan
4. If implementation work was started on `main` by mistake, stop and immediately move that work onto a Graphite branch before making any further edits or commits

**After all plan tasks are complete:**
1. Run `cr review` (CodeRabbit CLI) to catch issues locally
2. Fix any relevant findings and commit those fixes on the same Graphite branch
3. Run the `code-simplifier` skill to review changed code for reuse, quality, and efficiency
4. Run `gt submit --stack --no-interactive` to push and create the PR
5. Unless explicitly asked to keep as draft, run `gh pr ready <number>` to mark the PR as ready for review
6. Update the PR description with a summary, event table, and test plan
7. Do not stop after coding is done; the plan is not complete until the Graphite branch exists and the post-plan submit steps above are either finished or explicitly deferred by the user

**Required completion checklist for plan work:**

- Branch created with `gt create` before edits
- Work implemented on the Graphite branch, not `main`
- Relevant local verification run
- `cr review` run and valid findings addressed
- Changes committed on the same branch
- `gt submit --stack --no-interactive` run
- PR marked ready unless explicitly left draft
- PR body updated with summary, events, and test plan

This ensures every plan execution produces a clean Graphite branch with a pre-reviewed, review-ready PR — no implementation on `main`, no manual branch creation after the fact, and no post-submit fix cycles caused by skipping the required review flow.

## Never Do

- `git push --force` (or `-f`) to any branch
- `git reset --hard`
- `git add -A` or `git add .`
- `--no-verify` or `--no-gpg-sign`
- `git commit --amend` after a hook failure (the commit didn't happen — amend modifies the _previous_ commit)
- Delete `.env` files or files containing secrets
- Commit `.env`, credentials, or secrets

## When to Ask vs Proceed

| Situation                                    | Action               |
| -------------------------------------------- | -------------------- |
| Single-file bug fix with obvious cause       | Proceed              |
| Multi-file refactor                          | Ask or use plan mode |
| Unclear requirements                         | Ask                  |
| Destructive operation (delete, reset, force) | Always ask           |
| New dependency needed                        | Ask                  |
| Architecture decision between approaches     | Use plan mode        |
| Failing tests after a change                 | Debug, don't ask     |
| Need to modify shared infrastructure         | Always ask           |

## Plan Mode

**Use when:** Multi-file changes, architecture decisions, unclear scope, multiple valid approaches, new features.

**Skip when:** Single-file fixes, typo corrections, obvious bugs, user gave specific instructions.

## Code Style (Storefront)

- **Normalize emails to lowercase** — always apply `.toLowerCase()` before storing, comparing, or sending emails to the Medusa SDK. Medusa's auth provider uses case-sensitive matching, so `EricCrow@pm.me` and `ericcrow@pm.me` are treated as different accounts. Normalize at the server action boundary (e.g., `customer.ts`, `checkout.ts`), not in UI components.
- **TailwindPlus (Tailwind UI) components as the design system** — always use TailwindPlus components as the starting point for any new UI. Reference the component catalog at `/Users/itsjusteric/CrowCommerce/Resources/TailwindUI/tailwindplus-components.json` to find matching components before building custom UI.
- **Headless UI** for accessible interactive elements (Dialog, Menu, Popover, etc.)
- **clsx** for conditional class composition
- **RSC-first** — only use `'use client'` when interactivity is needed
- **Named exports** — `export function Foo()` not `export default function Foo()`
- **kebab-case** directories, **PascalCase** component files
- Minimize `useState` / `useEffect` — prefer server components, Server Actions, URL params
- No `nuqs` — use native `URLSearchParams` for URL state

## Code Style (Backend)

- Follow Medusa v2 conventions: custom modules in `src/modules/`, API routes in `src/api/`, workflows in `src/workflows/`
- Use `MedusaService` for service classes, `defineMiddlewares` for middleware, `createWorkflow`/`createStep` for workflows
- **Medusa workflows are NOT Vercel Workflow DevKit.** The Vercel plugin validation hook flags `createWorkflow()` and `.run()` as "legacy API" — these are false positives. Medusa v2 uses `createWorkflow` from `@medusajs/framework/workflows-sdk`, `emitEventStep` from `@medusajs/medusa/core-flows`, and `workflow(container).run()` invocations. This is the correct API for this project. Ignore Vercel WDK suggestions (e.g., `"use workflow"` directive, `start()` from `"workflow/api"`, workflow sandbox scope warnings) when working on backend code.
- Admin UI extensions in `src/admin/` use `@medusajs/ui` component library
- Custom middleware implementations go in `src/api/middlewares/` (e.g., `rate-limit.ts`) and are wired via `src/api/middlewares.ts`
- Rate limiting: Redis-backed failed-attempt tracking on `/auth/customer/emailpass*` and `/auth/user/emailpass*` — 5 failures per 15 min per IP. Gracefully degrades without Redis.
- See `src/modules/README.md`, `src/api/README.md`, `src/workflows/README.md` for patterns

## Analytics Events

When implementing any new feature, add PostHog tracking as part of the feature PR — not as a follow-up.

**Patterns:**

- Server-side: `trackServer(event, props)` from `lib/analytics-server` — use in server actions, API routes, subscribers
- Client-side: `trackClient(event, props)` from `lib/analytics.ts` — use in client components for interactions that only exist on the client (drawer opens, toggles, UI state changes)
- All events must be added to the `AnalyticsEvents` type map with typed properties before use (enforced by TypeScript)
- Naming: `snake_case`, `noun_verbed` (e.g., `product_added_to_cart`, `wishlist_created`, `checkout_payment_failed`)
- Include entity IDs and context as properties (`product_id`, `order_id`, etc.) but **never PII** (email, name, address)

**What to track for new features:**

| Category | Example |
| --- | --- |
| Happy path completions | `review_submitted`, `address_added` |
| Error/failure states | `checkout_payment_failed`, `auth_rate_limited` |
| Intent signals | `review_form_opened` (started but may not finish) |
| Navigation/discovery | `collection_filter_changed`, `sort_option_selected` |

**When NOT to add events:** pure admin operations, events already covered by PostHog pageviews, high-frequency events without analytical value (e.g., every keystroke — track the submission instead).

**PR convention:** include new event names and their properties in the PR description so reviewers can verify naming consistency. Reference the `AnalyticsEvents` type map as the source of truth.

## Error Monitoring (Sentry)

When implementing any new feature, add Sentry error capture as part of the feature PR — not as a follow-up.

**Patterns:**

- Server-side: `Sentry.captureException(error, { tags: { ... }, extra: { ... } })` from `@sentry/nextjs` (storefront) or `@sentry/node` (backend)
- Attach context: include entity IDs (`order_id`, `cart_id`, `product_id`) as tags, and relevant state as `extra` — **never PII**
- Use `Sentry.withScope(scope => { ... })` when you need to attach context to a specific capture without polluting the global scope

**What to capture for new features:**

| Category | Example |
| --- | --- |
| Handled errors in commerce flows | Payment failures, checkout step errors, API call failures that return fallback values |
| Background job/subscriber failures | Workflow step errors, event handler catches, scheduled job failures |
| External service errors | Medusa SDK errors, Stripe API errors, Resend delivery failures, Meilisearch sync errors |

**When NOT to capture:** expected control flow (e.g., 404 for missing resources), validation errors that are shown to the user, errors already captured by Sentry's automatic instrumentation (uncaught exceptions, unhandled promise rejections).

**Key rule:** If a `catch` block swallows an error and returns a fallback value, ask whether that failure should be visible in Sentry. Commerce-critical paths (checkout, payment, cart, orders) should almost always capture.

## MCP Servers

| Server         | Use                                   |
| -------------- | ------------------------------------- |
| **Playwright** | Browser testing and screenshots       |
| **Context7**   | Up-to-date library documentation      |
| **Linear**     | Issue tracking and project management |
| **PostHog**    | Analytics, feature flags, experiments |

## Review guidelines

### P0 — Security
- All server actions must validate and sanitize input before processing
- Cookie operations must use the dedicated functions in `lib/medusa/cookies.ts` — never set cookies directly
- Cookies must use httpOnly, sameSite strict, and secure (in production) flags
- No sensitive data (cart IDs, customer info, payment sessions, JWT tokens) exposed in client components or client-side code
  - **Exception:** Stripe Payment Element requires `client_secret` on the client, and cart IDs in payment callback URLs are needed for redirect-based flows (3D Secure, PayPal). Server actions validate cart ownership via `assertSessionCart()`.
- No API keys, secrets, or tokens in client bundles — check for `NEXT_PUBLIC_` prefix misuse
- Server actions handling cart/checkout mutations must enforce authentication where required via `getAuthHeaders()`
- Payment flows must not be manipulable — no client-controlled pricing, no cart state injection, no replay vectors
- All customer-facing API routes must validate the requesting user owns the resource (prevent IDOR)
- Never trust Stripe `redirect_status` or client-side payment intent status — always validate server-side via `completeCart()`
- `STRIPE_WEBHOOK_SECRET` must be set whenever `STRIPE_API_KEY` is configured — flag if webhook verification is missing or bypassed
- Express checkout flows must validate email presence before proceeding to payment
- Non-terminal payment statuses (e.g., "processing", "requires_action") must surface user-facing errors — never silently no-op or swallow the status

### P0 — Correctness
- Cart mutations must call both `revalidateTag(TAGS.cart, "max")` AND `revalidatePath("/", "layout")` — missing either causes stale UI
- Cart revalidation must run in `finally` blocks so optimistic state re-syncs even on failure
- Medusa v2 prices are in major currency units (10 = $10.00) — never divide by 100
- Cart subtotal for display must use `item_subtotal` not `subtotal` (which includes shipping)
- API calls fetching product prices or variants must include `region_id` for calculated prices
- Error handling must use `medusaError()` from `lib/medusa/error.ts` — not raw try/catch with generic messages

### P1 — Architecture
- Client components must be limited to interactive needs (dialogs, optimistic updates, keyboard shortcuts) — default to RSC
- Server actions must follow the established pattern in `components/cart/actions.ts`
- No new `any` types in changed files — existing `any` usage in legacy files (order confirmation, checkout types) is tracked separately

### P1 — Maintainability
- Functions exceeding 80 lines should be flagged for review — procedural flows like checkout handlers may be acceptable if linear and well-commented
- Duplicated logic across server actions should use shared helpers
- Consistent error handling patterns across all server actions
- TypeScript strict mode compliance — no unchecked index access

## Project Overview

Next.js 16 ecommerce storefront built on Vercel's Commerce template, enhanced with premium Tailwind UI components. Integrates with a local Medusa.js v2 backend via the Store REST API. Designed for a polished, production-ready shopping experience with static generation, optimistic cart updates, and granular caching.

## Tech Stack

| Technology       | Version         | Purpose                                      |
| ---------------- | --------------- | -------------------------------------------- |
| Next.js          | 16.0.7 (canary) | App Router, RSC, Server Actions              |
| React            | 19.0.0          | Server Components, `useOptimistic`           |
| TypeScript       | 5.8.2           | Strict mode, `noUncheckedIndexedAccess`      |
| Tailwind CSS     | 4.x             | CSS-first config, `@theme` tokens            |
| Headless UI      | 2.2.x           | Accessible interactive components            |
| @medusajs/js-sdk | 2.13.x          | REST client for Medusa Store API             |
| @medusajs/types  | 2.13.x          | TypeScript types for Medusa responses        |
| clsx             | 2.1.x           | Conditional class composition                |
| ioredis          | 5.x             | Redis client (auth rate limiting)            |
| Geist            | 1.3.x           | Font family                                  |
| Vitest           | 4.x             | Unit testing (installed, not configured yet) |
| Playwright       | 1.56.x          | E2E testing (configured, 40 wishlist specs)  |

## Directory Structure

```text
storefront/                        # Next.js 16 frontend
├── app/
│   ├── (auth)/                    # Route group — auth pages (no layout file)
│   │   └── account/
│   │       ├── login/             # Sign-in page
│   │       ├── register/          # Create account page
│   │       ├── forgot-password/   # Request password reset
│   │       └── reset-password/    # Set new password (from email link)
│   ├── (store)/                   # Route group — shares store layout
│   │   ├── layout.tsx             # Store-specific layout (nav + footer)
│   │   ├── products/
│   │   │   ├── page.tsx           # All products grid
│   │   │   └── [collection]/      # Collection-filtered products
│   │   └── search/
│   │       ├── page.tsx           # Search results
│   │       └── [collection]/      # Collection-specific search
│   ├── product/[handle]/          # Product detail pages (static generation)
│   ├── [page]/                    # Dynamic CMS pages (stub)
│   ├── api/revalidate/            # Webhook endpoint for cache invalidation
│   ├── page.tsx                   # Home page
│   ├── layout.tsx                 # Root layout
│   └── globals.css                # Tailwind v4 theme tokens
├── components/
│   ├── cart/                      # Cart drawer, actions (Server Actions), optimistic UI
│   ├── home/                      # Home page sections, Tailwind UI product/collection types
│   ├── layout/                    # Desktop/mobile navigation, footer
│   ├── price/                     # Context-specific price components (grid, detail, cart)
│   ├── product/                   # Product detail components
│   ├── reviews/                   # Product review form and display
│   ├── search-command/            # Command palette (Cmd+K) with debounced search
│   └── wishlist/                  # Heart button, wishlist page client, social proof count
├── lib/
│   ├── medusa/
│   │   ├── index.ts               # SDK client + all data-fetching functions
│   │   ├── cookies.ts             # Secure cookie management + auth headers
│   │   ├── customer.ts            # Customer auth: login, signup, signout, password reset, profile
│   │   ├── error.ts               # Centralized Medusa SDK error formatting
│   │   ├── transforms.ts          # Medusa → internal type transformations
│   │   └── wishlist.ts            # Wishlist server actions + data fetching
│   ├── constants.ts               # Cache tags, sort options, hidden product tag
│   ├── constants/navigation.ts    # DEFAULT_NAVIGATION fallback, UTILITY_NAV
│   ├── types.ts                   # Backend-agnostic internal types
│   ├── validation.ts              # Shared validation (password length)
│   └── utils.ts                   # URL helpers, env validation, Tailwind UI transforms
├── playwright.config.ts           # E2E test config (Chromium + Firefox)
├── tests/e2e/                     # E2E test suites
│   ├── fixtures/                  # API, auth, and wishlist test fixtures
│   ├── helpers/                   # Shared selectors
│   └── wishlist/                  # 10 wishlist spec files (40 tests)
├── package.json
└── next.config.ts

backend/                           # Medusa v2 backend
├── src/
│   ├── modules/                   # Custom modules (data models, services)
│   ├── api/                       # Custom REST API routes
│   │   ├── middlewares.ts         # Route middleware config (auth, validation, rate limiting)
│   │   └── middlewares/           # Custom middleware implementations
│   │       └── rate-limit.ts      # Redis-backed auth rate limiting
│   ├── workflows/                 # Custom workflows and steps
│   ├── links/                     # Module link definitions
│   ├── admin/                     # Admin UI extensions (React/Vite)
│   ├── subscribers/               # Event subscribers
│   └── scripts/                   # CLI scripts (seed, etc.)
├── medusa-config.ts
└── package.json
```

## Route Structure

| Route                      | Purpose                  | Notes                                |
| -------------------------- | ------------------------ | ------------------------------------ |
| `/`                        | Home page                | Static                               |
| `/products`                | All products grid        | Collection-filtered                  |
| `/products/[collection]`   | Products by collection   | Dynamic                              |
| `/product/[handle]`        | Product detail           | `generateStaticParams` at build time |
| `/search`                  | Search results           | Query-based                          |
| `/search/[collection]`     | Search within collection | Dynamic                              |
| `/collections/*`           | Rewrite                  | Rewrites to `/products/*`            |
| `/[page]`                  | CMS pages                | Stub — Medusa has no CMS             |
| `/account/login`           | Sign in                  | Redirects if logged in               |
| `/account/register`        | Create account           | Redirects if logged in               |
| `/account/forgot-password` | Request password reset   | Redirects if logged in               |
| `/account/reset-password`  | Set new password         | Accepts `token` + `email` params     |
| `/account/wishlist`        | Wishlist management      | Auth-protected, multi-list UI        |
| `/wishlist/shared/[token]` | Shared wishlist view     | Public read-only, import for authed  |
| `/api/revalidate`          | Webhook                  | Cache invalidation endpoint          |

## Data Layer Architecture

Three-layer type system with explicit transform boundaries:

### Layer 1: Medusa SDK Types

`HttpTypes.StoreProduct`, `HttpTypes.StoreCollection`, `HttpTypes.StoreCart` — raw REST responses from `@medusajs/types`.

### Layer 2: Internal Types (`lib/types.ts`)

Backend-agnostic types: `Product`, `Cart`, `Collection`, `Menu`, `Page`, `Navigation`. Used throughout the app. Could be backed by any commerce API.

### Layer 3: Tailwind UI Types (`components/home/types.ts`)

Component-specific types matching Tailwind UI component props: `Product` (grid format), `Collection` (card format).

Also in `lib/utils.ts`: `TailwindProductDetail`, `TailwindRelatedProduct`.

### Transform Chain

```text
Medusa SDK → transforms.ts → Internal Types → utils.ts → Tailwind UI Types
  (Layer 1)                    (Layer 2)                   (Layer 3)
```

**`lib/medusa/transforms.ts`** (Layer 1 → Layer 2):

- `transformProduct()` — `HttpTypes.StoreProduct` → `Product`
- `transformCollection()` — `HttpTypes.StoreCollection` → `Collection`
- `transformCart()` — `HttpTypes.StoreCart` → `Cart`

**`lib/utils.ts`** (Layer 2 → Layer 3):

- `transformProductToTailwind()` — Grid/catalog format
- `transformProductToTailwindDetail()` — Product detail page
- `transformProductsToRelatedProducts()` — Related products section
- `transformCollectionToTailwind()` — Collection card format
- `getColorHex()` — Maps color names to hex codes for variant swatches

## Medusa SDK Client

Configured in `lib/medusa/index.ts`:

```typescript
const sdk = new Medusa({
  baseUrl: process.env.MEDUSA_BACKEND_URL || "http://localhost:9000",
  debug: false,
  publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
});
```

**Single-region mode:** `getDefaultRegion()` fetches the first region and caches it in memory. All product queries include `region_id` to get `calculated_price`.

**Field expansion:** Products use `PRODUCT_FIELDS` to get calculated prices, inventory, and variant images. Carts use `CART_FIELDS` to get items with product/variant/thumbnail data, plus promotions and shipping methods.

**Cookie management (`lib/medusa/cookies.ts`):** All cookie access goes through dedicated functions (`getCartId`, `setCartId`, `removeCartId`, `getAuthToken`, `setAuthToken`, `removeAuthToken`). Cart cookie is `_medusa_cart_id` with `httpOnly`, `sameSite: strict`, `secure` (in prod), 30-day expiry. Auth token cookie is `_medusa_jwt` with same security flags, 7-day expiry.

**Auth headers:** `getAuthHeaders()` returns `{ authorization: "Bearer ..." }` when a JWT exists, or `{}` otherwise. All cart mutations and customer operations pass auth headers to the SDK.

**Auth actions (`lib/medusa/customer.ts`):** `login`, `signup`, `signout`, `requestPasswordReset`, `completePasswordReset`, `retrieveCustomer`, `updateCustomer`, address CRUD. All actions normalize emails to lowercase. Password reset actions use `sdk.auth.resetPassword()` and `sdk.auth.updateProvider()`. Rate-limited responses (429) are detected via `isRateLimited()` helper and surfaced as user-friendly messages.

**Password validation (`lib/validation.ts`):** `validatePassword()` enforces 8–128 character length. Used in `signup()` and `completePasswordReset()` server-side, and in register/reset forms client-side via exported `MIN_PASSWORD_LENGTH` constant.

**Error handling (`lib/medusa/error.ts`):** `medusaError()` formats `FetchError` from `@medusajs/js-sdk` (shape: `{ status, statusText, message }`) into user-readable `Error` objects with server-side logging.

## Exported Data Functions

| Function                                   | Cache         | Tags                    | Lifetime |
| ------------------------------------------ | ------------- | ----------------------- | -------- |
| `getProduct(handle)`                       | `"use cache"` | `products`              | `days`   |
| `getProducts({query, reverse, sortKey})`   | `"use cache"` | `products`              | `days`   |
| `getProductRecommendations(productId)`     | `"use cache"` | `products`              | `days`   |
| `getCollection(handle)`                    | `"use cache"` | `collections`           | `days`   |
| `getCollectionProducts({collection, ...})` | `"use cache"` | `collections, products` | `days`   |
| `getCollections()`                         | `"use cache"` | `collections`           | `days`   |
| `getNavigation()`                          | `"use cache"` | `collections`           | `days`   |
| `getMenu(handle)`                          | `"use cache"` | `collections`           | `days`   |
| `getCart()`                                | No cache      | —                       | —        |
| `getOrSetCart()`                           | No cache      | —                       | —        |
| `createCart()`                             | No cache      | —                       | —        |
| `addToCart(lines)`                         | No cache      | —                       | —        |
| `removeFromCart(lineIds)`                  | No cache      | —                       | —        |
| `updateCart(lines)`                        | No cache      | —                       | —        |
| `getPage(handle)`                          | No cache      | —                       | Stub     |
| `getPages()`                               | No cache      | —                       | Stub     |

## Caching Strategy

Uses Next.js 16 experimental caching with `"use cache"` directive:

```typescript
export async function getProduct(handle: string) {
  "use cache";
  cacheTag(TAGS.products);
  cacheLife("days");
  // ...
}
```

**next.config.ts:**

```typescript
{
  cacheComponents: true;
}
```

**Cache tags** (defined in `lib/constants.ts`): `collections`, `products`, `cart`, `customers`, `reviews`, `wishlists`.

**Invalidation:**

- Cart mutations: `revalidateTag(TAGS.cart, "max")` + `revalidatePath("/", "layout")`
- Webhook (`/api/revalidate`): Revalidates all three tags
- Manual: `rm -rf .next` and restart dev server

## Cart State Management

**Critical:** Cart updates require **both** tag revalidation **and** path revalidation for UI to update without hard refresh.

### Cart Pricing Fields

Medusa v2 cart total fields — use the right one for each context:

| Field | Meaning | Use for |
|-------|---------|---------|
| `item_subtotal` | Sum of line item subtotals (items only, excl. tax) | "Subtotal" label in cart/checkout |
| `subtotal` | `item_subtotal` + `shipping_subtotal` (excl. tax) | Rarely — includes shipping |
| `shipping_total` | Shipping after discounts, incl. tax | "Shipping" line item |
| `tax_total` | Total tax amount | "Tax" line item |
| `total` | Final total after discounts/credits, incl. tax | "Total" / "Order total" |

**Important:** `transformCart()` in `lib/medusa/transforms.ts` maps `cost.subtotalAmount` → `cart.item_subtotal` (not `cart.subtotal`) so that the internal `Cart` type's subtotal represents items only.

### Flow

1. **Storage:** Cart ID stored in `_medusa_cart_id` cookie (secure, httpOnly) via `lib/medusa/cookies.ts`
2. **Creation:** `createCartAndSetCookie()` → `createCart()` (sets cookie internally)
3. **Mutations:** Server Actions in `components/cart/actions.ts`:
   - `addItem(prevState, variantId)` — Add to cart
   - `removeItem(prevState, lineItemId)` — Remove from cart (uses line item ID directly)
   - `updateItemQuantity(prevState, {merchandiseId, quantity})` — Update quantity
   - `redirectToCheckout()` — Redirects to `/checkout`
4. **Optimistic UI:** Cart components use `useOptimistic` for instant feedback
5. **Revalidation pattern** (every mutation, in `finally` block):
   ```typescript
   revalidateTag(TAGS.cart, "max");
   revalidatePath("/", "layout"); // Essential for immediate UI updates
   ```
6. **Error recovery:** Revalidation runs in `finally` blocks — ensures optimistic state re-syncs even on failure

### Cart UI

- Sliding drawer using Headless UI `Dialog`
- Auto-opens when item is added
- Optimistic updates for instant feedback on add/remove/quantity changes

## Navigation System

`getNavigation()` builds nav from Medusa collections:

1. Fetches all collections via `getCollections()`
2. If collections exist (>1, since "All" is always added), maps them to nav links
3. Merges with `DEFAULT_NAVIGATION` categories structure
4. Falls back entirely to `DEFAULT_NAVIGATION` when no collections found

**Constants** (`lib/constants/navigation.ts`):

- `DEFAULT_NAVIGATION` — Full fallback with Women/Men categories, featured, brands
- `UTILITY_NAV` — Account, Support links

**Footer:** `getMenu("footer")` returns first 6 collections as footer links.

## Component Patterns

### RSC vs Client Split

Most components are Server Components. Client components are used only for:

- Cart drawer (Dialog interaction)
- Search command palette (keyboard shortcuts, input state)
- Add-to-cart button (optimistic updates via `useActionState`)
- Mobile menu (Dialog interaction)
- Wishlist button (heart toggle with server action)
- Wishlist page client (multi-tab, create/rename/delete dialogs, share)
- Review form (star rating, form submission)

### Price Components (`components/price/`)

Three context-specific components instead of one flexible component:

- `ProductGridPrice.tsx` — Grid/catalog views
- `ProductDetailPrice.tsx` — Product detail page
- `CartPrice.tsx` — Cart drawer

### Search Command Palette (`components/search-command/`)

- Opens with Cmd+K / Ctrl+K
- Real-time product search with debouncing
- Keyboard navigation support
- Uses `getProducts({ query })` for search

## Tailwind CSS v4

**CSS-first configuration** — no `tailwind.config.ts`. Everything in `app/globals.css`:

```css
@import "tailwindcss";
@plugin "@tailwindcss/container-queries";
@plugin "@tailwindcss/typography";

@theme {
  --color-primary-50: #eef2ff;
  --color-primary-500: #6366f1;
  --color-primary-600: #4f46e5;
  /* ... full primary + secondary scales */
}
```

**Theming:** Change `--color-primary-*` values in `@theme` to retheme the site. See [RETHEME.md](./RETHEME.md) for full guide.

## Environment Variables

| Variable                             | Required | Default                 | Purpose                               |
| ------------------------------------ | -------- | ----------------------- | ------------------------------------- |
| `MEDUSA_BACKEND_URL`                 | Yes      | `http://localhost:9000` | Medusa REST API URL                   |
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | Yes      | —                       | Medusa publishable API key            |
| `SITE_NAME`                          | No       | —                       | Store name in metadata                |
| `COMPANY_NAME`                       | No       | —                       | Company name in footer                |
| `REVALIDATE_SECRET`                  | No       | —                       | Webhook secret for cache invalidation |
| `VERCEL_PROJECT_PRODUCTION_URL`      | No       | —                       | Auto-set by Vercel for `baseUrl`      |

Validated on startup by `validateEnvironmentVariables()` in `lib/utils.ts`. Only `MEDUSA_BACKEND_URL` and `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` are required.

## Medusa Backend

Lives at `backend/` within this monorepo. Uses PostgreSQL 17 with `medusa_db` database. Part of the bun workspace monorepo.

### Starting

```bash
brew services start postgresql@17          # 1. Start PostgreSQL
cd backend && bun run dev                  # 2. Start Medusa (port 9000)
cd storefront && bun dev                   # 3. Start storefront (port 3000)
# Or from root: bun run dev               # Start both in parallel
```

### Stopping

```bash
# Ctrl+C in storefront terminal
# Ctrl+C in Medusa terminal
brew services stop postgresql@17            # Optional
```

### Admin

Dashboard at `http://localhost:9000/app`. Manages products, collections, orders, regions, settings.

### Useful Commands

```bash
cd backend
bun run dev                                                  # Start dev server
bunx medusa db:migrate                                       # Run pending migrations
bunx medusa db:generate <module-name>                        # Generate migration for custom module
bunx medusa user -e admin@example.com -p password            # Create admin user
```

### Retrieving the Publishable API Key

```bash
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
psql medusa_db -t -c "SELECT token FROM api_key WHERE type = 'publishable' LIMIT 1;"
```

## Testing Infrastructure

**Configured:**

- **Playwright** 1.56.x — E2E testing (`cd storefront && bunx playwright test`)
  - Chromium + Firefox (2 browsers × 40 tests = 80 runs)
  - Custom fixtures for API, auth, and wishlist setup
  - Retries enabled (2) to handle Turbopack dev server flakiness
  - 10 spec files covering: guest, authenticated, heart-button, heart-state, sharing, import, transfer, nav-badge, rename-delete, social-proof

**Not yet configured:**

- **Vitest** 4.x — Unit testing (`bun run test:unit`)
- **Testing Library** — React component testing (`@testing-library/react`, `@testing-library/jest-dom`)
- **happy-dom** — Lightweight DOM implementation for Vitest

## Common Pitfalls

1. **Cart not updating:** Both `revalidateTag(TAGS.cart, "max")` AND `revalidatePath("/", "layout")` are required. Missing either causes stale UI.
2. **Products not showing:** Medusa backend must be running with at least one region configured.
3. **Prices showing $0.00:** Products need `calculated_price` — ensure `region_id` is passed in API queries.
4. **Price amounts are NOT in cents:** Medusa v2 stores all prices in major currency units (10 = $10.00). This applies to product prices, cart totals, and shipping option amounts. Never divide by 100 — `toMoney()`, `formatMoney()`, and `Intl.NumberFormat` receive amounts as-is.
5. **Cart subtotal includes shipping:** Medusa v2's `cart.subtotal` = `item_subtotal` + `shipping_subtotal`. For an items-only subtotal (what customers expect to see labeled "Subtotal"), use `cart.item_subtotal`. Our `transformCart()` maps `cost.subtotalAmount` to `cart.item_subtotal` for this reason.
6. **Stale prices after transform changes:** Clear the Next.js cache (`rm -rf .next`) and restart dev.
7. **Color variants not displaying:** Variants must have a "Color" option (case-insensitive match).
8. **Navigation empty:** Falls back to `DEFAULT_NAVIGATION` from `lib/constants/navigation.ts`. This is expected when no collections exist in Medusa.
9. **Build failures:** Usually missing env vars or Medusa backend unreachable.
10. **Pages returning empty:** Medusa has no native CMS. `getPage()` / `getPages()` return stubs.

## TypeScript Configuration

| Setting                    | Value     | Effect                                                                  |
| -------------------------- | --------- | ----------------------------------------------------------------------- |
| `strict`                   | `true`    | All strict checks enabled                                               |
| `noUncheckedIndexedAccess` | `true`    | Array/object access requires null checks                                |
| `baseUrl`                  | `"."`     | Absolute imports from project root (`import { Cart } from 'lib/types'`) |
| `target`                   | `ES2022`  | Output target                                                           |
| `moduleResolution`         | `Bundler` | Bundler-style module resolution                                         |

## Image Optimization

Remote patterns configured in `next.config.ts`:

| Hostname                                          | Purpose                     |
| ------------------------------------------------- | --------------------------- |
| `localhost`                                       | Local Medusa backend images |
| `medusa-public-images.s3.eu-west-1.amazonaws.com` | Medusa hosted images        |
| `medusa-server-testing.s3.amazonaws.com`          | Medusa testing images       |
| `via.placeholder.com`                             | Placeholder images          |
| `tailwindcss.com`                                 | Tailwind UI demo assets     |

Formats: AVIF and WebP.

## Production Deployment

**Vercel ownership:** This storefront lives under the Vercel team **CrowCommerce** with slug `crow-commerce`. The correct project path is `crow-commerce/commerce-tailwindui-medusa`. Do not use `crowcommerce` or the similarly named `crow-development` team for this repo.

| Service | Platform | URL | CLI Access |
|---------|----------|-----|------------|
| **Backend** | Railway | `https://api.medusa.crowcommerce.org` | `railway` CLI (installed, linked). Use `railway variables` to audit env vars, `railway run` to execute commands in production. |
| **Storefront** | Vercel | `https://medusa.crowcommerce.org` | `vercel` CLI. Project: `crow-commerce/commerce-tailwindui-medusa`. Use `vercel env ls --scope crow-commerce` to audit env vars. |
| **Preview** | Vercel | `https://preview.medusa.crowcommerce.org` | Same Vercel project, preview environment |
| **Admin UI** | Railway | `https://api.medusa.crowcommerce.org/app` | Served from backend |
| **Meilisearch** | Meilisearch Cloud | `https://ms-812b362930a3-43619.sfo.meilisearch.io` | Dashboard at cloud.meilisearch.com |

**Admin / test credentials:** Stored in `backend/.env` (gitignored) under `ADMIN_EMAIL` and `ADMIN_PASSWORD`. These work for both the admin UI (`/app`) and as a storefront customer account. Use them for testing and troubleshooting against local, preview, and production deployments.

**Redeploy storefront:**
```bash
# Verify you are targeting the correct Vercel team/project first
vercel project ls --scope crow-commerce | grep commerce-tailwindui-medusa

# Get latest production deployment URL
vercel list --scope crow-commerce --prod 2>&1 | head -7
# Redeploy it (copies the deployment URL from above)
vercel redeploy <deployment-url> --scope crow-commerce
```

**Redeploy backend:** Push to `main` — Railway auto-deploys on push. Or trigger manually from the Railway dashboard.

## See Also

| File                                   | Purpose                                                   |
| -------------------------------------- | --------------------------------------------------------- |
| [CLAUDE.md](./CLAUDE.md)               | Companion workflow guide and cross-reference              |
| [README.md](README.md)                 | Project status dashboard and feature overview             |
| [SETUP.md](SETUP.md)                   | Setup guide for local dev and production deployment       |
| [TODO.md](./TODO.md)                   | Code review follow-ups, testing, infra, known limitations |
| [CHANGELOG.md](./CHANGELOG.md)         | Release history                                           |
